import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductListQuerySchema, type VisualSearchResult } from '@nixzora/validation';
import sharp from 'sharp';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ReadDatabase } from '../../prisma/read-database';
import { RedisService } from '../../redis/redis.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { type ImageQuery, LANGUAGE_MODEL, type LanguageModel } from '../assistant/language-model';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { StorageService } from '../media/storage.service';
import { vectorLiteral, visualSignature } from './visual-signature';

/** Largest photo accepted: a phone camera's full-size JPEG (the website shrinks it first). */
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const RESULT_TTL_SECONDS = 30 * 60;
const RESULTS = 24;
/** Nearest images looked at before grouping them by product. */
const NEAREST_IMAGES = 400;
/** Reciprocal-rank fusion constant (the usual 60). */
const RRF_K = 60;
const INDEX_EVERY_MS = 5 * 60_000;
const INDEX_BATCH = 50;
const MAX_TRIES = 3;

type StoredResult = { ids: string[]; query: string | null; category: string | null };

/**
 * Search by photo (p10-14, ADR-0036). The shopper's photo is reduced to a colour and layout
 * signature and compared with every product image's signature in pgvector. When a paid model is
 * configured (and within today's AI budget) it also names the pictured product, and the text
 * search's results are blended in. The photo is never stored: only the result (product ids) is
 * kept in Redis for 30 minutes so the storefront can render it on a page.
 */
@Injectable()
export class VisualSearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(VisualSearchService.name);
  private timer?: NodeJS.Timeout;
  private indexing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly read: ReadDatabase,
    private readonly storage: StorageService,
    private readonly catalog: CatalogQueryService,
    private readonly redis: RedisService,
    private readonly usage: AiUsageService,
    @Inject(LANGUAGE_MODEL) private readonly llm: LanguageModel,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config)) return;
    const run = () => void this.indexPending().catch(() => undefined);
    setTimeout(run, 10_000).unref();
    this.timer = setInterval(run, INDEX_EVERY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  // ───── Searching ─────

  /** `image`: the photo's bytes (the app uploads them raw; the website sends base64 JSON). */
  async search(image: Buffer): Promise<VisualSearchResult> {
    if (image.length > MAX_IMAGE_BYTES) {
      throw new BadRequestException('That picture is too large. Try a smaller photo.');
    }
    await this.checkImage(image);
    const signature = await visualSignature(image);

    const [visual, described] = await Promise.all([this.nearest(signature), this.describe(image)]);
    let ids = visual;
    if (described) {
      const text = await this.catalog.listProducts(
        ProductListQuerySchema.parse({ q: described.query, pageSize: RESULTS }),
      );
      ids = fuse([text.items.map((card) => card.id), visual]);
    }
    ids = ids.slice(0, RESULTS);

    const id = randomUUID();
    const stored: StoredResult = {
      ids,
      query: described?.query ?? null,
      category: described?.category ?? null,
    };
    await this.redis.client
      .set(this.key(id), JSON.stringify(stored), 'EX', RESULT_TTL_SECONDS)
      .catch((error: Error) => this.logger.warn(`Could not keep a photo result: ${error.message}`));
    return this.view(id, stored);
  }

  /** A recent result again, with live prices and stock. */
  async result(id: string): Promise<VisualSearchResult> {
    const raw = await this.redis.client.get(this.key(id)).catch(() => null);
    if (!raw) throw new NotFoundException('This photo search has expired. Search again.');
    return this.view(id, JSON.parse(raw) as StoredResult);
  }

  private key(id: string): string {
    return `vsearch:${id}`;
  }

  private async view(id: string, stored: StoredResult): Promise<VisualSearchResult> {
    const [products, category] = await Promise.all([
      this.catalog.cardsByIds(stored.ids),
      stored.category
        ? this.read.client.category.findFirst({
            where: { slug: stored.category, isActive: true },
            select: { slug: true, name: true },
          })
        : null,
    ]);
    return { id, products, query: stored.query, category: category ?? null };
  }

  /** Refuses anything that is not a readable photo of a sensible size. */
  private async checkImage(image: Buffer): Promise<void> {
    try {
      const meta = await sharp(image, { limitInputPixels: 50_000_000 }).metadata();
      const formats = new Set(['jpeg', 'png', 'webp', 'heif', 'avif', 'gif']);
      if (
        meta.format &&
        formats.has(meta.format) &&
        (meta.width ?? 0) >= 32 &&
        (meta.height ?? 0) >= 32
      ) {
        return;
      }
    } catch {
      // Falls through to the refusal.
    }
    throw new BadRequestException('We couldn’t read that picture. Try a JPEG or PNG photo.');
  }

  /** Active products whose closest image is nearest the photo, closest first. */
  private async nearest(signature: number[]): Promise<string[]> {
    const rows = await this.read.client.$queryRaw<{ id: string }[]>`
      WITH near AS (
        SELECT product_id, visual <=> ${vectorLiteral(signature)}::vector AS distance
        FROM product_images
        WHERE visual IS NOT NULL
        ORDER BY visual <=> ${vectorLiteral(signature)}::vector
        LIMIT ${NEAREST_IMAGES}
      )
      SELECT near.product_id::text AS id
      FROM near JOIN products p ON p.id = near.product_id AND p.status = 'ACTIVE'
      GROUP BY near.product_id
      ORDER BY MIN(near.distance)
      LIMIT ${RESULTS * 2}`;
    return rows.map((row) => row.id);
  }

  /** What a paid model sees in the photo; null with the local model, over budget, or on error. */
  private async describe(image: Buffer): Promise<ImageQuery | null> {
    if (this.llm.driver === 'local') return null;
    if (!(await this.usage.withinBudget())) return null;
    const started = Date.now();
    try {
      const small = await sharp(image)
        .rotate()
        .flatten({ background: '#ffffff' })
        .resize(512, 512, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 75 })
        .toBuffer();
      const categories = await this.read.client.category.findMany({
        where: { isActive: true },
        select: { slug: true, name: true },
      });
      const { looksFor, usage } = await this.llm.describeImage({
        jpegBase64: small.toString('base64'),
        categories,
      });
      await this.usage.record({
        feature: 'photo_search',
        driver: this.llm.driver,
        model: this.llm.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs: Date.now() - started,
        grounded: looksFor !== null,
      });
      return looksFor;
    } catch (error) {
      await this.usage.record({
        feature: 'photo_search',
        driver: this.llm.driver,
        model: this.llm.model,
        latencyMs: Date.now() - started,
        error: (error instanceof Error ? error.message : String(error)).slice(0, 200),
      });
      return null;
    }
  }

  // ───── Indexing ─────

  /**
   * Signs product images that have no signature yet (new uploads, the demo catalog), a batch at
   * a time. An image that cannot be read is retried on the next two passes, then left alone.
   */
  async indexPending(limit = 1000): Promise<{ indexed: number; failed: number }> {
    if (this.indexing) return { indexed: 0, failed: 0 };
    this.indexing = true;
    let indexed = 0;
    let failed = 0;
    try {
      while (indexed + failed < limit) {
        const batch = await this.prisma.$queryRaw<{ id: string; storage_key: string }[]>`
          SELECT id::text, storage_key FROM product_images
          WHERE visual IS NULL AND visual_tries < ${MAX_TRIES}
          ORDER BY id
          LIMIT ${Math.min(INDEX_BATCH, limit - indexed - failed)}`;
        if (!batch.length) break;
        for (const image of batch) {
          const signature = await this.signatureOf(image.storage_key);
          if (signature) {
            await this.prisma.$executeRaw`
              UPDATE product_images SET visual = ${vectorLiteral(signature)}::vector
              WHERE id = ${image.id}::uuid`;
            indexed += 1;
          } else {
            await this.prisma.$executeRaw`
              UPDATE product_images SET visual_tries = visual_tries + 1
              WHERE id = ${image.id}::uuid`;
            failed += 1;
          }
        }
      }
      if (indexed || failed) {
        this.logger.log(`Photo search: signed ${indexed} images, ${failed} not readable`);
      }
      return { indexed, failed };
    } finally {
      this.indexing = false;
    }
  }

  private async signatureOf(key: string): Promise<number[] | null> {
    const bytes = await this.storage.readServed(key);
    if (!bytes) return null;
    try {
      return await visualSignature(bytes);
    } catch (error) {
      this.logger.debug(`Image ${key} could not be signed: ${(error as Error).message}`);
      return null;
    }
  }
}

/** Reciprocal-rank fusion: each list adds 1/(60 + rank) to an id's score. */
export function fuse(lists: string[][]): string[] {
  const score = new Map<string, number>();
  for (const list of lists) {
    list.forEach((id, rank) => score.set(id, (score.get(id) ?? 0) + 1 / (RRF_K + rank + 1)));
  }
  return [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}
