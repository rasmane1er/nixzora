import {
  Injectable,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  COMPLEMENTS,
  type DepartmentSlug,
  type ProductCard,
  REPLENISH_DAYS,
  type Recommendations,
  type RelatedProducts,
  type SmartRow,
  type TrafficSource,
} from '@nixzora/validation';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { countView } from '../catalog/traffic';
import { ReadDatabase } from '../../prisma/read-database';
import { CartService, type CartOwner } from '../cart/cart.service';
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
/** A search typed within this window that extends the last one ("run" → "running shoes") replaces it. */
const INTEREST_MERGE_MS = 2 * 60 * 1000;
/** Interests older than this no longer make a "Because you searched…" row. */
const INTEREST_ROW_DAYS = 30;
/** Product views at least this many separate times in two weeks mean "still thinking about it". */
const REPEAT_VIEWS = 2;
/** Smart rows shown at most, and products per row. */
const MAX_ROWS = 4;
const ROW_SIZE = 8;

export type InterestSource = 'SEARCH' | 'ASSISTANT';

/** "  Running   Shoes!! " → "running shoes!!": lower case, single spaces, 120 characters. */
export function normalizeInterest(text: string): string {
  return text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 120);
}
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
    private readonly carts: CartService,
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

  /** Signed-in customers can turn personalized picks off; guests have them on. */
  async personalized(userId: string | undefined): Promise<boolean> {
    if (!userId) return true;
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { personalizedPicks: true },
    });
    return user?.personalizedPicks ?? true;
  }

  /**
   * Records a product view. Returns false when it was ignored for picks (anonymous, opted out,
   * repeat or unknown). Store analytics (p10-25) count every view of a live product except a
   * quick repeat by the same shopper, and keep no shopper with the count.
   */
  async recordView(
    productId: string,
    shopper: Shopper,
    source: TrafficSource = 'DIRECT',
  ): Promise<boolean> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!product) return false;
    const known = Boolean(shopper.userId || shopper.visitorId);
    if (!known || !(await this.personalized(shopper.userId))) {
      await countView(this.prisma, productId, source);
      return false;
    }

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
    await countView(this.prisma, productId, source);
    return true;
  }

  /**
   * Records what a shopper is looking for (a search, or a need told to the assistant). Typing
   * that extends the previous search replaces it; the same words again only refresh it.
   */
  async recordInterest(
    rawText: string,
    source: InterestSource,
    shopper: Shopper,
    categorySlug: string | null = null,
    now = new Date(),
  ): Promise<boolean> {
    const text = normalizeInterest(rawText);
    if (text.length < 2 || (!shopper.userId && !shopper.visitorId)) return false;
    if (!(await this.personalized(shopper.userId))) return false;

    const mine = { source, ...this.shopperWhere(shopper) };
    const last = await this.prisma.shopperInterest.findFirst({
      where: mine,
      orderBy: { updatedAt: 'desc' },
    });
    const sameTyping =
      last &&
      now.getTime() - last.updatedAt.getTime() < INTEREST_MERGE_MS &&
      (text.startsWith(last.text) || last.text.startsWith(text));
    if (last && sameTyping) {
      await this.prisma.shopperInterest.update({
        where: { id: last.id },
        data: {
          text: text.length >= last.text.length ? text : last.text,
          categorySlug: categorySlug ?? last.categorySlug,
          updatedAt: now,
        },
      });
      return true;
    }
    const same = await this.prisma.shopperInterest.findFirst({
      where: { ...mine, text },
      select: { id: true },
    });
    if (same) {
      await this.prisma.shopperInterest.update({
        where: { id: same.id },
        data: { updatedAt: now, ...(categorySlug ? { categorySlug } : {}) },
      });
      return true;
    }
    await this.prisma.shopperInterest.create({
      data: {
        source,
        text,
        categorySlug,
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
    const interests = await this.prisma.shopperInterest.deleteMany({
      where: { updatedAt: { lt: cutoff } },
    });
    return count + interests.count;
  }

  /** "Clear my shopping history": views and interests of this customer (and this browser/app). */
  async clearHistory(shopper: Shopper): Promise<void> {
    if (!shopper.userId && !shopper.visitorId) return;
    const where = this.shopperWhere(shopper);
    await this.prisma.$transaction([
      this.prisma.productEvent.deleteMany({ where }),
      this.prisma.shopperInterest.deleteMany({ where }),
    ]);
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

  async forShopper(
    shopper: Shopper,
    cart: CartOwner | null = null,
    limit = 8,
  ): Promise<Recommendations> {
    const popular = async (exclude: string[] = []) =>
      inStockFirst(await this.catalog.cardsByIds(await this.popularIds(limit * 2)))
        .filter((card) => !exclude.includes(card.id))
        .slice(0, limit);

    if (!(await this.personalized(shopper.userId))) {
      return { basis: 'popular', products: await popular(), recentlyViewed: [], rows: [] };
    }
    const recentIds = await this.recentlyViewedIds(shopper, 20);
    const recentlyViewed = (await this.catalog.cardsByIds(recentIds)).slice(0, 8);
    const rows = await this.smartRows(shopper, cart).catch(() => [] as SmartRow[]);

    if (recentIds.length) {
      const exclude = [...recentIds, ...(await this.purchasedIds(shopper.userId))];
      const ids = await this.nearCentroidIds(recentIds.slice(0, 10), exclude, limit * 2);
      const products = inStockFirst(await this.catalog.cardsByIds(ids)).slice(0, limit);
      if (products.length >= Math.min(4, limit)) {
        return { basis: 'history', products, recentlyViewed, rows };
      }
    }
    return { basis: 'popular', products: await popular(recentIds), recentlyViewed, rows };
  }

  /**
   * Products this shopper is most likely to want, best first, from everything we know: what
   * they viewed, have in their cart or saved, and searched for. Used for home page ads. Empty for
   * new shoppers and when personalized picks are off.
   */
  async affinityIds(shopper: Shopper, limit: number): Promise<string[]> {
    if (!shopper.userId && !shopper.visitorId) return [];
    if (!(await this.personalized(shopper.userId))) return [];
    const [viewed, saved, interests] = await Promise.all([
      this.recentlyViewedIds(shopper, 10),
      shopper.userId ? this.savedIds(shopper.userId, 10) : Promise.resolve([]),
      this.recentInterests(shopper, 1),
    ]);
    const seeds = [...new Set([...viewed, ...saved])];
    const [near, searched] = await Promise.all([
      seeds.length ? this.nearCentroidIds(seeds, [], limit) : Promise.resolve([]),
      interests[0] ? this.interestIds(interests[0].text, interests[0].categorySlug, limit) : [],
    ]);
    // Alternate the two lists, so a fresh search counts as much as browsing history.
    const merged: string[] = [];
    for (let i = 0; i < Math.max(near.length, searched.length); i++) {
      if (searched[i]) merged.push(searched[i]!);
      if (near[i]) merged.push(near[i]!);
    }
    return [...new Set(merged)].slice(0, limit);
  }

  // ───────────── Smart rows (p10-02) ─────────────

  /**
   * Rows that guess what the shopper needs, most telling signal first: the cart (about to buy),
   * products they keep coming back to, saved items that got cheaper, things running out, what
   * they searched for or asked the assistant, and accessories for what they bought.
   */
  async smartRows(shopper: Shopper, cart: CartOwner | null, now = new Date()): Promise<SmartRow[]> {
    if (!shopper.userId && !shopper.visitorId && !cart) return [];
    const [purchases, cartIds, interests] = await Promise.all([
      this.purchases(shopper.userId, now),
      cart ? this.cartProductIds(cart) : Promise.resolve([]),
      this.recentInterests(shopper, 2, now),
    ]);
    const owned = new Set(purchases.map((p) => p.productId));
    const taken = new Set<string>([...cartIds]);
    const rows: SmartRow[] = [];
    const add = (
      kind: SmartRow['kind'],
      cards: ProductCard[],
      extra: {
        subject?: string | null;
        source?: SmartRow['source'];
        min?: number;
        keepOwned?: boolean;
      } = {},
    ) => {
      const products = cards
        .filter((card) => !taken.has(card.id) && (extra.keepOwned || !owned.has(card.id)))
        .slice(0, ROW_SIZE);
      if (products.length < (extra.min ?? 2)) return;
      products.forEach((card) => taken.add(card.id));
      rows.push({ kind, subject: extra.subject ?? null, source: extra.source ?? null, products });
    };

    if (cartIds.length) {
      const cartCards = await this.catalog.cardsByIds(cartIds);
      const together = await this.boughtTogetherIds(cartIds[0]!, 4);
      const complements = await this.complementIds(
        cartCards.map((card) => card.category?.slug).filter((slug): slug is string => !!slug),
        [...cartIds],
      );
      add('cart_addons', inStockOnly(await this.catalog.cardsByIds([...together, ...complements])));
    }

    add(
      'still_thinking',
      inStockFirst(await this.catalog.cardsByIds(await this.repeatViewedIds(shopper, now))),
      {
        min: 1,
      },
    );

    if (shopper.userId) add('saved_deals', await this.cheaperSaved(shopper.userId), { min: 1 });

    const restock = purchases.filter((p) => {
      const days = p.categorySlug ? REPLENISH_DAYS[p.categorySlug as DepartmentSlug] : undefined;
      return days !== undefined && now.getTime() - p.lastAt.getTime() >= days * 0.7 * 86_400_000;
    });
    if (restock.length) {
      add('restock', inStockOnly(await this.catalog.cardsByIds(restock.map((p) => p.productId))), {
        min: 1,
        keepOwned: true,
      });
    }

    for (const interest of interests) {
      const ids = await this.interestIds(interest.text, interest.categorySlug, ROW_SIZE * 2);
      add('interest', inStockFirst(await this.catalog.cardsByIds(ids)), {
        subject: interest.text,
        source: interest.source === 'ASSISTANT' ? 'assistant' : 'search',
      });
    }

    const recent = purchases.find(
      (p) =>
        p.categorySlug &&
        COMPLEMENTS[p.categorySlug as DepartmentSlug] &&
        now.getTime() - p.lastAt.getTime() < 90 * 86_400_000,
    );
    if (recent?.categorySlug) {
      const ids = await this.complementIds([recent.categorySlug], [...owned]);
      add('accessories', inStockOnly(await this.catalog.cardsByIds(ids)), {
        subject: recent.title,
      });
    }
    return rows.slice(0, MAX_ROWS);
  }

  /** Products the shopper opened on REPEAT_VIEWS separate visits in the last two weeks. */
  private async repeatViewedIds(shopper: Shopper, now: Date): Promise<string[]> {
    if (!shopper.userId && !shopper.visitorId) return [];
    const rows = await this.prisma.productEvent.groupBy({
      by: ['productId'],
      where: {
        type: 'VIEW',
        createdAt: { gt: new Date(now.getTime() - 14 * 86_400_000) },
        ...this.shopperWhere(shopper),
      },
      _count: { _all: true },
      _max: { createdAt: true },
      orderBy: { _max: { createdAt: 'desc' } },
      take: 40,
    });
    return rows.filter((row) => row._count._all >= REPEAT_VIEWS).map((row) => row.productId);
  }

  private async recentInterests(shopper: Shopper, limit: number, now = new Date()) {
    if (!shopper.userId && !shopper.visitorId) return [];
    return this.prisma.shopperInterest.findMany({
      where: {
        updatedAt: { gt: new Date(now.getTime() - INTEREST_ROW_DAYS * 86_400_000) },
        ...this.shopperWhere(shopper),
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      select: { text: true, source: true, categorySlug: true },
    });
  }

  /** The search results for an interest, inside the category the assistant understood. */
  private async interestIds(text: string, categorySlug: string | null, limit: number) {
    const rank = await this.catalog.searchRank(text, 'ACTIVE');
    let ids = [...rank.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
    if (categorySlug && ids.length) {
      const categoryIds = await this.catalog.categoryAndDescendantIds(categorySlug);
      if (categoryIds.length) {
        const inside = await this.prisma.product.findMany({
          where: { id: { in: ids }, categoryId: { in: categoryIds } },
          select: { id: true },
        });
        const keep = new Set(inside.map((row) => row.id));
        ids = ids.filter((id) => keep.has(id));
      }
    }
    return ids.slice(0, limit);
  }

  /**
   * Well-reviewed products from the categories that go with these (COMPLEMENTS), taking turns
   * between categories so a laptop gets a mouse, a keyboard and a monitor, not three mice.
   */
  private async complementIds(categorySlugs: string[], exclude: string[]): Promise<string[]> {
    const wanted = [
      ...new Set(categorySlugs.flatMap((slug) => COMPLEMENTS[slug as DepartmentSlug] ?? [])),
    ].filter((slug) => !categorySlugs.includes(slug));
    if (!wanted.length) return [];
    const lists = await Promise.all(
      wanted.map(async (slug) => {
        const categoryIds = await this.catalog.categoryAndDescendantIds(slug);
        const rows = await this.read.client.$queryRaw<{ id: string }[]>`
          SELECT p.id::text AS id
          FROM products p
          LEFT JOIN reviews r ON r.product_id = p.id AND r.status = 'APPROVED'
          WHERE p.status = 'ACTIVE'
            AND p.category_id = ANY(${categoryIds}::uuid[])
            AND NOT (p.id = ANY(${exclude}::uuid[]))
          GROUP BY p.id
          ORDER BY COALESCE(AVG(r.rating), 0) * LN(2 + COUNT(r.id)) DESC, p.created_at DESC
          LIMIT 4`;
        return rows.map((row) => row.id);
      }),
    );
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) for (const list of lists) if (list[i]) ids.push(list[i]!);
    return ids;
  }

  /** Paid purchases in the last year, latest first, one entry per product. */
  private async purchases(userId: string | undefined, now: Date) {
    if (!userId) return [];
    const rows = await this.prisma.$queryRaw<
      { product_id: string; title: string; category_slug: string | null; last_at: Date }[]
    >`
      SELECT v.product_id::text AS product_id, p.title, c.slug AS category_slug,
             MAX(o.placed_at) AS last_at
      FROM orders o
      JOIN order_items i ON i.order_id = o.id
      JOIN product_variants v ON v.id = i.variant_id
      JOIN products p ON p.id = v.product_id
      LEFT JOIN categories c ON c.id = p.category_id
      WHERE o.user_id = ${userId}::uuid
        AND o.status::text = ANY(${PAID_STATUSES})
        AND o.placed_at > ${new Date(now.getTime() - 365 * 86_400_000)}
      GROUP BY v.product_id, p.title, c.slug
      ORDER BY last_at DESC
      LIMIT 50`;
    return rows.map((row) => ({
      productId: row.product_id,
      title: row.title,
      categorySlug: row.category_slug,
      lastAt: new Date(row.last_at),
    }));
  }

  private async cartProductIds(owner: CartOwner): Promise<string[]> {
    const quantities = await this.carts.quantities(owner).catch(() => new Map<string, number>());
    if (!quantities.size) return [];
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: [...quantities.keys()] } },
      select: { productId: true },
    });
    return [...new Set(variants.map((variant) => variant.productId))];
  }

  private async savedIds(userId: string, limit: number): Promise<string[]> {
    const rows = await this.prisma.wishlistItem.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: { productId: true },
    });
    return rows.map((row) => row.productId);
  }

  /** Saved products whose price is now lower than when they were saved, biggest drop first. */
  private async cheaperSaved(userId: string): Promise<ProductCard[]> {
    const saved = await this.prisma.wishlistItem.findMany({
      where: { userId, priceCentsAtSave: { not: null } },
      select: { productId: true, priceCentsAtSave: true },
      take: 200,
    });
    if (!saved.length) return [];
    const was = new Map(saved.map((row) => [row.productId, row.priceCentsAtSave!]));
    return (await this.catalog.cardsByIds([...was.keys()]))
      .filter((card) => card.inStock && card.priceFromCents < was.get(card.id)!)
      .sort((a, b) => a.priceFromCents / was.get(a.id)! - b.priceFromCents / was.get(b.id)!);
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

function inStockOnly(cards: ProductCard[]): ProductCard[] {
  return cards.filter((card) => card.inStock);
}

/** Keeps the order, but sold-out products go last. */
function inStockFirst(cards: ProductCard[]): ProductCard[] {
  return [...cards.filter((card) => card.inStock), ...cards.filter((card) => !card.inStock)];
}
