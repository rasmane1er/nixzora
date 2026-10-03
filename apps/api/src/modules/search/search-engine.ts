import { randomUUID } from 'node:crypto';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { EMBEDDINGS, type EmbeddingsProvider, contentHash, toPgVector } from '../ai/embeddings';
import { buildSearchDocument, type IndexableProduct } from './search-documents';

export type ScoredIds = Map<string, number>;

export type RetrieveOptions = {
  /** Only products with this status (the storefront passes ACTIVE). */
  status?: string;
  limit?: number;
  /** Raises the semantic similarity floor (the assistant wants confident matches only). */
  minSimilarity?: number;
  /** Allow any-word keyword matches when nothing else matched (default true). */
  allowLoose?: boolean;
};

const productForIndex = {
  brand: { select: { name: true } },
  category: { select: { name: true, parent: { select: { name: true } } } },
  variants: { where: { isActive: true }, select: { title: true, sku: true, options: true } },
} satisfies Prisma.ProductInclude;

/** Reciprocal rank fusion constant: 60 is the value from the original paper and common practice. */
const RRF_K = 60;
const LOCK_KEY = 'search:reindex:lock';

/**
 * Minimum cosine similarity for a semantic match. Below it a query has nothing meaningful in
 * common with a product, so "zzzz" returns nothing instead of the nearest random products.
 */
const MIN_SIMILARITY: Record<EmbeddingsProvider['driver'], number> = {
  local: 0.12,
  voyage: 0.3,
};

/** Semantic matches below this fraction of the best match's similarity are dropped. */
const RELATIVE_CUTOFF = 0.5;

/** Merges ranked lists: score = Σ 1 / (k + rank). Ids found by both retrievers rise to the top. */
export function reciprocalRankFusion(lists: string[][], k = RRF_K): ScoredIds {
  const scores: ScoredIds = new Map();
  for (const list of lists) {
    list.forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + 1 / (k + index + 1)));
  }
  return new Map([...scores.entries()].sort((a, b) => b[1] - a[1]));
}

/**
 * The search index (ADR-0009): one row per product in product_search_docs with a weighted
 * tsvector (keyword search) and an embedding (semantic search), merged with RRF.
 */
@Injectable()
export class SearchEngine {
  private readonly logger = new Logger(SearchEngine.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly usage: AiUsageService,
    @Inject(EMBEDDINGS) private readonly embeddings: EmbeddingsProvider,
  ) {}

  get embeddingModel(): string {
    return this.embeddings.model;
  }

  /** Rebuilds one product's document (outbox handler). Returns false when nothing changed. */
  async indexProduct(productId: string): Promise<boolean> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: productForIndex,
    });
    if (!product) return false; // deleted: the row went with it (ON DELETE CASCADE)
    const [changed] = await this.write([product]);
    return changed ?? false;
  }

  /**
   * Indexes every product whose text or embedding model changed. Only one API instance runs it
   * at a time (Redis lock), so several tasks starting together do not pay for embeddings twice.
   */
  async reindexAll(options: { force?: boolean } = {}): Promise<{
    scanned: number;
    updated: number;
    skipped: boolean;
  }> {
    const token = randomUUID();
    const locked = await this.redis.client.set(LOCK_KEY, token, 'EX', 900, 'NX');
    if (!locked) return { scanned: 0, updated: 0, skipped: true };
    let scanned = 0;
    let updated = 0;
    try {
      let cursor: string | undefined;
      for (;;) {
        const page = await this.prisma.product.findMany({
          include: productForIndex,
          orderBy: { id: 'asc' },
          take: 100,
          ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
        });
        if (!page.length) break;
        scanned += page.length;
        updated += (await this.write(page, options.force)).filter(Boolean).length;
        cursor = page[page.length - 1]!.id;
      }
      return { scanned, updated, skipped: false };
    } finally {
      await this.redis.client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
        1,
        LOCK_KEY,
        token,
      );
    }
  }

  /** Index health for the admin panel. */
  async stats(): Promise<{ products: number; indexed: number; stale: number; model: string }> {
    const [products, indexed, stale] = await Promise.all([
      this.prisma.product.count(),
      this.prisma.productSearchDoc.count(),
      this.prisma.productSearchDoc.count({
        where: { embeddingModel: { not: this.embeddings.model } },
      }),
    ]);
    return { products, indexed, stale, model: this.embeddings.model };
  }

  /** True once at least one product is indexed with the current model. */
  async isReady(): Promise<boolean> {
    const row = await this.prisma.productSearchDoc.findFirst({
      where: { embeddingModel: this.embeddings.model },
      select: { productId: true },
    });
    return Boolean(row);
  }

  /** Keyword retrieval: every word first, then any word, best rank first. */
  async lexical(q: string, options: RetrieveOptions = {}): Promise<string[]> {
    const strict = await this.lexicalQuery(q, options, false);
    return strict.length ? strict : this.lexicalQuery(q, options, true);
  }

  /** Semantic retrieval: nearest embeddings above the driver's similarity floor. */
  async semantic(q: string, options: RetrieveOptions = {}): Promise<string[]> {
    const started = Date.now();
    const [vector] = await this.embeddings.embed([q], 'query');
    await this.recordEmbeddingCall('search', started);
    if (!vector) return [];
    const limit = options.limit ?? 60;
    const floor = Math.max(MIN_SIMILARITY[this.embeddings.driver], options.minSimilarity ?? 0);
    const rows = await this.prisma.$queryRaw<{ id: string; similarity: number }[]>`
      SELECT d.product_id::text AS id, (1 - (d.embedding <=> ${toPgVector(vector)}::vector))::float AS similarity
      FROM product_search_docs d
      JOIN products p ON p.id = d.product_id
      WHERE d.embedding IS NOT NULL
        AND d.embedding_model = ${this.embeddings.model}
        AND (${options.status ?? null}::text IS NULL OR p.status::text = ${options.status ?? null})
      ORDER BY d.embedding <=> ${toPgVector(vector)}::vector
      LIMIT ${limit}`;
    // Keep matches that are close to the best one: a clear headphones match should not drag in
    // every product that merely shares the word "wireless".
    const top = rows[0]?.similarity ?? 0;
    const cutoff = Math.max(floor, top * RELATIVE_CUTOFF);
    return rows.filter((row) => row.similarity >= cutoff).map((row) => row.id);
  }

  /**
   * Keyword and semantic results merged with reciprocal rank fusion. Loose keyword matching
   * (any word) is only used when the semantic side found nothing: for conversational queries
   * the embedding understands the sentence better than single shared words like "light".
   */
  async hybrid(q: string, options: RetrieveOptions = {}): Promise<ScoredIds> {
    const [strict, semantic] = await Promise.all([
      this.lexicalQuery(q, options, false),
      this.semantic(q, options).catch((error: Error) => {
        // A provider outage degrades to keyword search instead of failing the page.
        this.logger.warn(`Semantic search unavailable: ${error.message}`);
        return [] as string[];
      }),
    ]);
    const useLoose = options.allowLoose !== false && !strict.length && !semantic.length;
    const lexical = useLoose ? await this.lexicalQuery(q, options, true) : strict;
    return reciprocalRankFusion([lexical, semantic]);
  }

  /**
   * Keyword retrieval over the index, plus products that are not indexed yet (just created, or an
   * embedding call failed): their text is weighted on the fly, so search never loses a product.
   */
  private async lexicalQuery(
    q: string,
    options: RetrieveOptions,
    anyWord: boolean,
  ): Promise<string[]> {
    const query = anyWord
      ? Prisma.sql`NULLIF(replace(plainto_tsquery('english', ${q})::text, '&', '|'), '')::tsquery`
      : Prisma.sql`websearch_to_tsquery('english', ${q})`;
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH q AS (SELECT ${query} AS query),
      indexed AS (
        SELECT d.product_id AS id, ts_rank(d.document, q.query) AS rank
        FROM product_search_docs d, q
        WHERE d.document @@ q.query
      ),
      pending AS (
        SELECT p.id, ts_rank(doc.vector, q.query) AS rank
        FROM products p
        LEFT JOIN brands b ON b.id = p.brand_id
        JOIN categories c ON c.id = p.category_id
        CROSS JOIN LATERAL (
          SELECT setweight(to_tsvector('english', p.title || ' ' || coalesce(b.name, '')), 'A') ||
                 setweight(to_tsvector('english', c.name || ' ' || p.attributes::text), 'B') ||
                 setweight(to_tsvector('english', p.description), 'C') AS vector
        ) doc, q
        WHERE NOT EXISTS (SELECT 1 FROM product_search_docs d WHERE d.product_id = p.id)
          AND doc.vector @@ q.query
      )
      SELECT r.id::text AS id
      FROM (SELECT * FROM indexed UNION ALL SELECT * FROM pending) r
      JOIN products p ON p.id = r.id
      WHERE (${options.status ?? null}::text IS NULL OR p.status::text = ${options.status ?? null})
      ORDER BY r.rank DESC
      LIMIT ${options.limit ?? 60}`;
    return rows.map((row) => row.id);
  }

  /** Upserts documents, embedding only the ones whose text or model changed. */
  private async write(
    products: (IndexableProduct & { id: string })[],
    force = false,
  ): Promise<boolean[]> {
    const model = this.embeddings.model;
    const docs = products.map((product) => {
      const doc = buildSearchDocument(product);
      return { ...doc, hash: contentHash(doc.embeddingText, model) };
    });
    const existing = await this.prisma.productSearchDoc.findMany({
      where: { productId: { in: docs.map((doc) => doc.productId) } },
      select: { productId: true, contentHash: true },
    });
    const known = new Map(existing.map((row) => [row.productId, row.contentHash]));
    const changed = docs.filter((doc) => force || known.get(doc.productId) !== doc.hash);
    if (!changed.length) return docs.map(() => false);

    const started = Date.now();
    const vectors = await this.embeddings.embed(
      changed.map((doc) => doc.embeddingText),
      'document',
    );
    await this.recordEmbeddingCall('indexing', started);

    for (const [i, doc] of changed.entries()) {
      const vector = toPgVector(vectors[i]!);
      await this.prisma.$executeRaw`
        INSERT INTO product_search_docs
          (product_id, title_text, facets_text, body_text, content_hash, embedding_model, embedding, updated_at)
        VALUES (${doc.productId}::uuid, ${doc.titleText}, ${doc.facetsText}, ${doc.bodyText},
                ${doc.hash}, ${model}, ${vector}::vector, now())
        ON CONFLICT (product_id) DO UPDATE SET
          title_text = EXCLUDED.title_text,
          facets_text = EXCLUDED.facets_text,
          body_text = EXCLUDED.body_text,
          content_hash = EXCLUDED.content_hash,
          embedding_model = EXCLUDED.embedding_model,
          embedding = EXCLUDED.embedding,
          updated_at = now()`;
    }
    const changedIds = new Set(changed.map((doc) => doc.productId));
    return docs.map((doc) => changedIds.has(doc.productId));
  }

  /** Paid embedding calls are logged for the AI operations panel; local ones are free and not. */
  private async recordEmbeddingCall(feature: string, started: number): Promise<void> {
    if (this.embeddings.driver === 'local') return;
    const tokens = this.embeddings.lastTokens ?? 0;
    await this.usage.record({
      feature: `embeddings:${feature}`,
      driver: this.embeddings.driver,
      model: this.embeddings.model,
      inputTokens: tokens,
      latencyMs: Date.now() - started,
    });
  }
}
