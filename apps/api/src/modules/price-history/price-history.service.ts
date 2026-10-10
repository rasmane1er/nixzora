import {
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type BrowsingHistory, type PriceHistory } from '@nixzora/validation';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ReadDatabase } from '../../prisma/read-database';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { OutboxService } from '../outbox/outbox.service';
import { summarizePrices } from './price-summary';

const SWEEP_MS = 6 * 3_600_000;
const HISTORY_SIZE = 60;
/** Price events that may change a product's price. */
const PRICE_EVENTS = [
  'catalog.product.created',
  'catalog.product.updated',
  'catalog.product.published',
];

/**
 * Price history and browsing history (p10-19, ADR-0041). A point is written whenever a product's
 * lowest live price changes: right after the catalog event that changed it (an edit, a deal
 * starting or ending), and by a sweep every 6 hours that catches anything else.
 */
@Injectable()
export class PriceHistoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PriceHistoryService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly read: ReadDatabase,
    private readonly catalog: CatalogQueryService,
    private readonly outbox: OutboxService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    for (const type of PRICE_EVENTS) {
      this.outbox.on(type, async ({ aggregateId }) => {
        await this.record(aggregateId);
      });
    }
    if (!runsBackgroundJobs(this.config)) return;
    const run = () => void this.record().catch(() => undefined);
    setTimeout(run, 30_000).unref();
    this.timer = setInterval(run, SWEEP_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * Writes a point for each live product (or just this one) whose lowest active variant price
   * differs from its last point. Returns how many were written.
   */
  async record(productId?: string): Promise<number> {
    const only = productId ?? null;
    const written = await this.prisma.$executeRaw`
      WITH cur AS (
        SELECT v.product_id, MIN(v.price_cents) AS price
        FROM product_variants v
        JOIN products p ON p.id = v.product_id
        WHERE p.status = 'ACTIVE' AND v.is_active
          AND (${only}::uuid IS NULL OR v.product_id = ${only}::uuid)
        GROUP BY v.product_id
      ),
      last AS (
        SELECT DISTINCT ON (product_id) product_id, price_cents
        FROM price_points
        WHERE (${only}::uuid IS NULL OR product_id = ${only}::uuid)
        ORDER BY product_id, recorded_at DESC
      )
      INSERT INTO price_points (id, product_id, price_cents, recorded_at)
      SELECT gen_random_uuid(), cur.product_id, cur.price, now()
      FROM cur LEFT JOIN last ON last.product_id = cur.product_id
      WHERE last.price_cents IS DISTINCT FROM cur.price`;
    if (written && !only) this.logger.log(`Price history: ${written} changes recorded`);
    return written;
  }

  /** A product page's price chart. */
  async history(slug: string, days: number, now = new Date()): Promise<PriceHistory> {
    const product = await this.read.client.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: {
        id: true,
        variants: { where: { isActive: true }, select: { priceCents: true, currency: true } },
      },
    });
    if (!product || !product.variants.length) throw new NotFoundException('Product not found.');
    const current = Math.min(...product.variants.map((v) => v.priceCents));
    const start = new Date(now.getTime() - days * 86_400_000);
    const [before, inside] = await Promise.all([
      this.read.client.pricePoint.findFirst({
        where: { productId: product.id, recordedAt: { lte: start } },
        orderBy: { recordedAt: 'desc' },
      }),
      this.read.client.pricePoint.findMany({
        where: { productId: product.id, recordedAt: { gt: start } },
        orderBy: { recordedAt: 'asc' },
      }),
    ]);
    return summarizePrices(
      [...(before ? [before] : []), ...inside].map((p) => ({
        at: p.recordedAt,
        priceCents: p.priceCents,
      })),
      current,
      days,
      product.variants[0]!.currency,
      now,
    );
  }

  // ───── Browsing history ─────

  /** What this customer viewed, newest first, with the price then and any drop since. */
  async browsing(userId: string): Promise<BrowsingHistory> {
    const [user, viewed] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId }, select: { personalizedPicks: true } }),
      this.prisma.$queryRaw<{ product_id: string; viewed_at: Date; price_then: number | null }[]>`
        WITH seen AS (
          SELECT product_id, MAX(created_at) AS viewed_at
          FROM product_events
          WHERE user_id = ${userId}::uuid AND type = 'VIEW'
          GROUP BY product_id
          ORDER BY MAX(created_at) DESC
          LIMIT ${HISTORY_SIZE}
        )
        SELECT seen.product_id::text AS product_id, seen.viewed_at, (
          SELECT pp.price_cents FROM price_points pp
          WHERE pp.product_id = seen.product_id AND pp.recorded_at <= seen.viewed_at
          ORDER BY pp.recorded_at DESC LIMIT 1
        ) AS price_then
        FROM seen ORDER BY seen.viewed_at DESC`,
    ]);
    const ids = viewed.map((v) => v.product_id);
    const [cards, alerts] = await Promise.all([
      this.catalog.cardsByIds(ids),
      this.prisma.productAlert.findMany({
        where: { userId, kind: 'PRICE_DROP', productId: { in: ids } },
        select: { productId: true },
      }),
    ]);
    const byId = new Map(cards.map((c) => [c.id, c]));
    const alerted = new Set(alerts.map((a) => a.productId));
    return {
      paused: user ? !user.personalizedPicks : false,
      items: viewed.flatMap((v) => {
        const product = byId.get(v.product_id);
        if (!product) return [];
        const then = v.price_then === null ? null : Number(v.price_then);
        return [
          {
            product,
            viewedAt: v.viewed_at.toISOString(),
            priceThenCents: then,
            droppedCents: then !== null ? Math.max(0, then - product.priceFromCents) : 0,
            alertOn: alerted.has(product.id),
          },
        ];
      }),
    };
  }

  async forget(userId: string, productId: string): Promise<void> {
    await this.prisma.productEvent.deleteMany({ where: { userId, productId } });
  }
}
