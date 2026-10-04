import {
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ProductCard, type Recommendations, type RelatedProducts } from '@nixzora/validation';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { ReadDatabase } from '../../prisma/read-database';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { runsBackgroundJobs } from '../../common/background-jobs';

/** Who is shopping: a signed-in user, a guest's random visitor id, or both (just signed in). */
export type Shopper = { userId?: string; visitorId?: string };

/** Views of the same product by the same shopper within this window count once. */
const VIEW_DEDUPE_MS = 30 * 60 * 1000;
/** Events older than this are deleted (privacy policy: kept for 180 days). */
export const EVENT_RETENTION_DAYS = 180;
/**
 * "Customers also viewed" only shows a product seen by at least this many other shoppers, so
 * the list never reveals one person's browsing.
 */
const MIN_CO_VIEWERS = 2;
/** Same-category products get this bonus over raw similarity: a laptop page shows laptops first. */
const SAME_CATEGORY_BONUS = 0.15;
/** Products in a sibling category (same department, e.g. laptops and desktops) get this one. */
const SAME_DEPARTMENT_BONUS = 0.07;
const PAID_STATUSES = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'];
const SWEEP_MS = 6 * 60 * 60 * 1000;

/**
 * Recommendations (p6-07) from three signals, none of which needs a model call:
 * the semantic index (what a product is), orders (what sells together) and product views (p6-08).
 * Every list is made of live catalog cards, so prices and stock are always current.
 */
@Injectable()
export class RecommendationsService implements OnModuleInit, OnModuleDestroy {
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly read: ReadDatabase,
    private readonly prisma: PrismaService,
    private readonly catalog: CatalogQueryService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config)) return;
    this.sweeper = setInterval(() => void this.purgeOldEvents(), SWEEP_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  // ───────────── Signals ─────────────

  /** Records a product view. Returns false when it was ignored (anonymous, repeat or unknown). */
  async recordView(productId: string, shopper: Shopper): Promise<boolean> {
    if (!shopper.userId && !shopper.visitorId) return false;
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!product) return false;

    const recent = await this.prisma.productEvent.findFirst({
      where: {
        productId,
        type: 'VIEW',
        createdAt: { gt: new Date(Date.now() - VIEW_DEDUPE_MS) },
        ...this.shopperWhere(shopper),
      },
      select: { id: true },
    });
    if (recent) return false;

    await this.prisma.productEvent.create({
      data: {
        productId,
        type: 'VIEW',
        userId: shopper.userId ?? null,
        visitorId: shopper.visitorId ?? null,
      },
    });
    return true;
  }

  async purgeOldEvents(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - EVENT_RETENTION_DAYS * 86_400_000);
    const { count } = await this.prisma.productEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    return count;
  }

  // ───────────── Product page ─────────────

  async related(slug: string): Promise<RelatedProducts> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!product) throw new NotFoundException('Product not found.');

    const [similarIds, togetherIds, viewedIds] = await Promise.all([
      this.similarIds(product.id, 6),
      this.boughtTogetherIds(product.id, 4),
      this.alsoViewedIds(product.id, 6),
    ]);
    const boughtTogether = await this.catalog.cardsByIds(togetherIds);
    const taken = new Set([product.id, ...boughtTogether.map((card) => card.id)]);
    const alsoViewed = await this.catalog.cardsByIds(viewedIds.filter((id) => !taken.has(id)));
    alsoViewed.forEach((card) => taken.add(card.id));
    const similar = inStockFirst(
      await this.catalog.cardsByIds(similarIds.filter((id) => !taken.has(id))),
    ).slice(0, 6);
    return { similar, boughtTogether, alsoViewed: alsoViewed.slice(0, 6) };
  }

  /** Nearest products in the semantic index, same category first. */
  async similarIds(productId: string, limit: number): Promise<string[]> {
    const rows = await this.read.client.$queryRaw<{ id: string }[]>`
      WITH target AS (
        SELECT d.embedding, d.embedding_model, p.category_id, c.parent_id AS department_id
        FROM product_search_docs d
        JOIN products p ON p.id = d.product_id
        LEFT JOIN categories c ON c.id = p.category_id
        WHERE d.product_id = ${productId}::uuid AND d.embedding IS NOT NULL
      )
      SELECT d.product_id::text AS id
      FROM product_search_docs d
      JOIN products p ON p.id = d.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      CROSS JOIN target t
      WHERE d.product_id <> ${productId}::uuid
        AND d.embedding IS NOT NULL
        AND d.embedding_model = t.embedding_model
        AND p.status = 'ACTIVE'
      ORDER BY (1 - (d.embedding <=> t.embedding))
             + CASE WHEN p.category_id IS NOT DISTINCT FROM t.category_id
                    THEN ${SAME_CATEGORY_BONUS}::float
                    WHEN t.department_id IS NOT NULL AND c.parent_id = t.department_id
                    THEN ${SAME_DEPARTMENT_BONUS}::float
                    ELSE 0 END DESC
      LIMIT ${limit * 2}`;
    return rows.map((row) => row.id);
  }

  /** Products that appear in the same paid orders, most often first. */
  async boughtTogetherIds(productId: string, limit: number): Promise<string[]> {
    const rows = await this.read.client.$queryRaw<{ id: string }[]>`
      SELECT v2.product_id::text AS id
      FROM order_items a
      JOIN product_variants v1 ON v1.id = a.variant_id
      JOIN orders o ON o.id = a.order_id
      JOIN order_items b ON b.order_id = a.order_id AND b.id <> a.id
      JOIN product_variants v2 ON v2.id = b.variant_id
      WHERE v1.product_id = ${productId}::uuid
        AND v2.product_id <> ${productId}::uuid
        AND o.status::text = ANY(${PAID_STATUSES})
      GROUP BY v2.product_id
      ORDER BY COUNT(DISTINCT a.order_id) DESC, MAX(o.placed_at) DESC NULLS LAST
      LIMIT ${limit}`;
    return rows.map((row) => row.id);
  }

  /** Products viewed by shoppers who viewed this one (at least MIN_CO_VIEWERS of them). */
  async alsoViewedIds(productId: string, limit: number): Promise<string[]> {
    const rows = await this.read.client.$queryRaw<{ id: string }[]>`
      WITH viewers AS (
        SELECT DISTINCT COALESCE(user_id::text, visitor_id) AS shopper
        FROM product_events
        WHERE product_id = ${productId}::uuid AND created_at > now() - interval '90 days'
      )
      SELECT e.product_id::text AS id
      FROM product_events e
      JOIN viewers v ON v.shopper = COALESCE(e.user_id::text, e.visitor_id)
      JOIN products p ON p.id = e.product_id AND p.status = 'ACTIVE'
      WHERE e.product_id <> ${productId}::uuid AND e.created_at > now() - interval '90 days'
      GROUP BY e.product_id
      HAVING COUNT(DISTINCT v.shopper) >= ${MIN_CO_VIEWERS}
      ORDER BY COUNT(DISTINCT v.shopper) DESC
      LIMIT ${limit}`;
    return rows.map((row) => row.id);
  }

  // ───────────── For you ─────────────

  async forShopper(shopper: Shopper, limit = 8): Promise<Recommendations> {
    const recentIds = await this.recentlyViewedIds(shopper, 20);
    const recentlyViewed = (await this.catalog.cardsByIds(recentIds)).slice(0, 8);

    if (recentIds.length) {
      const exclude = [...recentIds, ...(await this.purchasedIds(shopper.userId))];
      const ids = await this.nearCentroidIds(recentIds.slice(0, 10), exclude, limit * 2);
      const products = inStockFirst(await this.catalog.cardsByIds(ids)).slice(0, limit);
      if (products.length >= Math.min(4, limit)) {
        return { basis: 'history', products, recentlyViewed };
      }
    }
    const products = inStockFirst(await this.catalog.cardsByIds(await this.popularIds(limit * 2)))
      .filter((card) => !recentIds.includes(card.id))
      .slice(0, limit);
    return { basis: 'popular', products, recentlyViewed };
  }

  private async recentlyViewedIds(shopper: Shopper, limit: number): Promise<string[]> {
    if (!shopper.userId && !shopper.visitorId) return [];
    const rows = await this.prisma.productEvent.groupBy({
      by: ['productId'],
      where: { type: 'VIEW', ...this.shopperWhere(shopper) },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: limit,
    });
    return rows.map((row) => row.productId);
  }

  private async purchasedIds(userId: string | undefined): Promise<string[]> {
    if (!userId) return [];
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT DISTINCT v.product_id::text AS id
      FROM orders o
      JOIN order_items i ON i.order_id = o.id
      JOIN product_variants v ON v.id = i.variant_id
      WHERE o.user_id = ${userId}::uuid AND o.status::text = ANY(${PAID_STATUSES})`;
    return rows.map((row) => row.id);
  }

  /** Products closest to the average of what the shopper looked at. */
  private async nearCentroidIds(seedIds: string[], exclude: string[], limit: number) {
    const rows = await this.read.client.$queryRaw<{ id: string }[]>`
      WITH seeds AS (
        SELECT embedding, embedding_model FROM product_search_docs
        WHERE product_id = ANY(${seedIds}::uuid[]) AND embedding IS NOT NULL
      ),
      model AS (
        SELECT embedding_model FROM seeds GROUP BY embedding_model ORDER BY COUNT(*) DESC LIMIT 1
      ),
      centroid AS (
        SELECT AVG(s.embedding) AS embedding, m.embedding_model
        FROM seeds s JOIN model m ON m.embedding_model = s.embedding_model
        GROUP BY m.embedding_model
      )
      SELECT d.product_id::text AS id
      FROM product_search_docs d
      JOIN products p ON p.id = d.product_id
      CROSS JOIN centroid c
      WHERE d.embedding IS NOT NULL
        AND d.embedding_model = c.embedding_model
        AND p.status = 'ACTIVE'
        AND NOT (d.product_id = ANY(${exclude}::uuid[]))
      ORDER BY d.embedding <=> c.embedding
      LIMIT ${limit}`;
    return rows.map((row) => row.id);
  }

  /** Most viewed and bought in the last 30 days (orders count triple); newest fill the rest. */
  async popularIds(limit: number): Promise<string[]> {
    const rows = await this.read.client.$queryRaw<{ id: string }[]>`
      WITH score AS (
        SELECT product_id, COUNT(*)::float AS points FROM product_events
        WHERE created_at > now() - interval '30 days' GROUP BY product_id
        UNION ALL
        SELECT v.product_id, 3 * COUNT(DISTINCT i.order_id)::float
        FROM order_items i
        JOIN orders o ON o.id = i.order_id
        JOIN product_variants v ON v.id = i.variant_id
        WHERE o.status::text = ANY(${PAID_STATUSES}) AND o.placed_at > now() - interval '30 days'
        GROUP BY v.product_id
      )
      SELECT p.id::text AS id
      FROM products p
      LEFT JOIN (SELECT product_id, SUM(points) AS points FROM score GROUP BY product_id) s
        ON s.product_id = p.id
      WHERE p.status = 'ACTIVE'
      ORDER BY COALESCE(s.points, 0) DESC, p.created_at DESC
      LIMIT ${limit}`;
    return rows.map((row) => row.id);
  }

  private shopperWhere(shopper: Shopper) {
    const or = [
      ...(shopper.userId ? [{ userId: shopper.userId }] : []),
      ...(shopper.visitorId ? [{ visitorId: shopper.visitorId }] : []),
    ];
    return { OR: or };
  }
}

/** Keeps the order, but sold-out products go last. */
function inStockFirst(cards: ProductCard[]): ProductCard[] {
  return [...cards.filter((card) => card.inStock), ...cards.filter((card) => !card.inStock)];
}
