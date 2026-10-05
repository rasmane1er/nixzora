import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type AdminProductListQuery,
  type CategoryNode,
  pagedResult,
  type PagedResult,
  type ProductCard,
  type ProductDetail,
  type ProductListQuery,
  type ProductLookup,
} from '@nixzora/validation';
import { type Env } from '../../config/env';
import { type Category, Prisma } from '../../generated/prisma/client';
import { ReadDatabase } from '../../prisma/read-database';
import { SearchIndexService } from '../search/search-index.service';
import { StorageService } from '../media/storage.service';
import { ratingSummary, roundRating } from '../../common/rating';
import { ancestorsOf, descendantIds } from './category-tree';
import {
  productInclude,
  type ProductWithRelations,
  toCard,
  toImage,
  toVariant,
} from './catalog-mappers';

/** Most search hits ranked for one query (the full-text fallback); filters and paging are in SQL. */
const MAX_CANDIDATES = 2000;

/**
 * Read side of the catalog: storefront listing, search and product pages.
 * Search uses PostgreSQL full-text search with a prefix fallback, which is plenty for
 * a catalog of thousands of products; OpenSearch with semantic search arrives in Phase 6.
 */
@Injectable()
export class CatalogQueryService {
  constructor(
    private readonly read: ReadDatabase,
    private readonly storage: StorageService,
    private readonly search: SearchIndexService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  /** Public catalog reads tolerate a second of staleness: the read replica when there is one. */
  private get prisma() {
    return this.read.client;
  }

  private readonly url = (key: string) => this.storage.publicUrl(key);

  async categoryTree(includeInactive = false): Promise<CategoryNode[]> {
    const [categories, counts] = await Promise.all([
      this.prisma.category.findMany({
        where: includeInactive ? {} : { isActive: true },
        orderBy: [{ position: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.product.groupBy({
        by: ['categoryId'],
        where: includeInactive ? {} : { status: 'ACTIVE' },
        _count: { _all: true },
      }),
    ]);
    const countBy = new Map(counts.map((row) => [row.categoryId, row._count._all]));

    const nodes = new Map<string, CategoryNode & { parentId: string | null }>();
    for (const category of categories) {
      nodes.set(category.id, {
        id: category.id,
        slug: category.slug,
        name: category.name,
        description: category.description,
        position: category.position,
        isActive: category.isActive,
        productCount: countBy.get(category.id) ?? 0,
        children: [],
        parentId: category.parentId,
      });
    }

    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      (parent ? parent.children : roots).push(node);
    }
    // A parent's count includes its descendants, so "Computers (42)" is meaningful.
    const total = (node: CategoryNode): number =>
      (node.productCount += node.children.reduce((sum, child) => sum + total(child), 0));
    roots.forEach(total);

    return roots.map(function strip(node): CategoryNode {
      const { parentId: _parentId, ...rest } = node as CategoryNode & { parentId: string | null };
      return { ...rest, children: node.children.map(strip) };
    });
  }

  brands() {
    return this.prisma.brand.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, slug: true, name: true },
    });
  }

  async listProducts(query: ProductListQuery): Promise<PagedResult<ProductCard>> {
    return this.list(query, { status: 'ACTIVE' }, true);
  }

  async listProductsForAdmin(
    query: AdminProductListQuery,
  ): Promise<PagedResult<ProductCard & { status: string }>> {
    const result = await this.list(query, query.status ? { status: query.status } : {}, false);
    return result as PagedResult<ProductCard & { status: string }>;
  }

  async productBySlug(slug: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('We could not find that product.');
    return this.toDetail(product, true);
  }

  /**
   * Resolves what the app's scanner read: a product link (QR code), a barcode (EAN/UPC) or a SKU.
   * iOS reports UPC-A codes as 13-digit EAN with a leading zero, so both spellings are tried.
   */
  async lookup(code: string): Promise<ProductLookup> {
    const link = /\/p\/([a-z0-9]+(?:-[a-z0-9]+)*)(?:[/?#]|$)/.exec(code);
    if (link?.[1]) {
      const product = await this.prisma.product.findFirst({
        where: { slug: link[1], status: 'ACTIVE' },
        select: { slug: true },
      });
      if (product) return { slug: product.slug, variantId: null };
      throw new NotFoundException('We could not find that product.');
    }

    const candidates = /^\d+$/.test(code)
      ? [
          code,
          code.length === 12 ? `0${code}` : null,
          /^0\d{12}$/.test(code) ? code.slice(1) : null,
        ]
      : [];
    const variant = await this.prisma.productVariant.findFirst({
      where: {
        isActive: true,
        product: { status: 'ACTIVE' },
        OR: [
          ...(candidates.length
            ? [{ barcode: { in: candidates.filter((c): c is string => c !== null) } }]
            : []),
          { sku: code.toUpperCase() },
        ],
      },
      select: { id: true, product: { select: { slug: true } } },
    });
    if (!variant) throw new NotFoundException('We could not find a product with that code.');
    return { slug: variant.product.slug, variantId: variant.id };
  }

  async productById(id: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: productInclude,
    });
    if (!product) throw new NotFoundException('Product not found.');
    return this.toDetail(product, false);
  }

  // ───────────── Internals ─────────────

  private async list(
    query: ProductListQuery,
    baseWhere: Prisma.ProductWhereInput,
    activeVariantsOnly: boolean,
  ): Promise<PagedResult<ProductCard>> {
    const where: Prisma.ProductWhereInput = { ...baseWhere };

    if (query.category) {
      const ids = await this.categoryAndDescendantIds(query.category);
      if (!ids.length) return emptyPage(query);
      where.categoryId = { in: ids };
    }
    if (query.brand) where.brand = { slug: query.brand };
    if (query.seller) where.seller = { handle: query.seller };

    // Newest first with no search or computed filters: let the database page it, so the
    // total is exact and only one page of products is loaded.
    if (
      !query.q &&
      query.sort === 'newest' &&
      query.minPrice === undefined &&
      query.maxPrice === undefined &&
      query.inStock === undefined
    ) {
      return this.pageNewest(query, where, activeVariantsOnly);
    }

    let rank: Map<string, number> | null = null;
    if (query.q) {
      rank = await this.searchRank(query.q, baseWhere.status as string | undefined);
      if (!rank.size) return emptyPage(query);
      where.id = { in: [...rank.keys()] };
    }
    return this.pageByFacts(query, where, activeVariantsOnly, rank);
  }

  /**
   * Price and stock filters and sorts, paged in the database. Prisma finds the matching ids
   * (category, brand, seller, search hits); one SQL query works out each product's card price
   * and stock (same rules as `toCard`), filters, sorts and pages them, so totals are exact at
   * any catalog size. Only the page's products are loaded in full.
   */
  private async pageByFacts(
    query: ProductListQuery,
    where: Prisma.ProductWhereInput,
    activeVariantsOnly: boolean,
    rank: Map<string, number> | null,
  ): Promise<PagedResult<ProductCard>> {
    const matching = await this.prisma.product.findMany({
      where: activeVariantsOnly ? { ...where, variants: { some: { isActive: true } } } : where,
      select: { id: true },
    });
    if (!matching.length) return emptyPage(query);
    const ids = matching.map((row) => row.id);
    // Search hits in rank order, best first, for the relevance sort.
    const ranked = rank ? [...rank.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id) : [];

    const order = {
      price_asc: Prisma.sql`price_from ASC, created_at DESC, id`,
      price_desc: Prisma.sql`price_from DESC, created_at DESC, id`,
      newest: Prisma.sql`created_at DESC, id`,
      relevance: rank
        ? Prisma.sql`array_position(${ranked}::uuid[], id), id`
        : Prisma.sql`in_stock DESC, created_at DESC, id`,
    }[query.sort];

    const facts = Prisma.sql`
      WITH facts AS (
        SELECT p.id, p.created_at,
          COALESCE(
            MIN(v.price_cents) FILTER (WHERE v.is_active),
            MIN(v.price_cents),
            0
          ) AS price_from,
          COALESCE(BOOL_OR(v.is_active AND COALESCE(i.on_hand - i.reserved, 0) > 0), false)
            AS in_stock
        FROM products p
        LEFT JOIN product_variants v ON v.product_id = p.id
        LEFT JOIN inventory_items i ON i.variant_id = v.id
        WHERE p.id = ANY(${ids}::uuid[])
        GROUP BY p.id, p.created_at
      )
      SELECT id, price_from, in_stock, created_at FROM facts
      WHERE (${query.minPrice ?? null}::int IS NULL OR price_from >= ${query.minPrice ?? null}::int)
        AND (${query.maxPrice ?? null}::int IS NULL OR price_from <= ${query.maxPrice ?? null}::int)
        AND (${query.inStock ?? null}::boolean IS NULL OR in_stock = ${query.inStock ?? null}::boolean)`;

    const [page, counted] = await Promise.all([
      this.prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM (${facts}) filtered
        ORDER BY ${order}
        LIMIT ${query.pageSize} OFFSET ${(query.page - 1) * query.pageSize}`,
      this.prisma.$queryRaw<{ total: bigint }[]>`SELECT COUNT(*) AS total FROM (${facts}) filtered`,
    ]);
    const total = Number(counted[0]?.total ?? 0);
    if (!page.length) return pagedResult([], total, query);

    const rows = await this.prisma.product.findMany({
      where: { id: { in: page.map((row) => row.id) } },
      include: productInclude,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    const cards = page.flatMap(({ id }) => {
      const row = byId.get(id);
      if (!row) return [];
      return [
        {
          ...toCard(
            activeVariantsOnly ? { ...row, variants: row.variants.filter((v) => v.isActive) } : row,
            this.url,
          ),
          status: row.status,
        },
      ];
    });
    return pagedResult(await this.withRatings(cards), total, query);
  }

  private async pageNewest(
    query: ProductListQuery,
    where: Prisma.ProductWhereInput,
    activeVariantsOnly: boolean,
  ): Promise<PagedResult<ProductCard>> {
    const filtered: Prisma.ProductWhereInput = activeVariantsOnly
      ? { ...where, variants: { some: { isActive: true } } }
      : where;
    const [rows, total] = await Promise.all([
      this.prisma.product.findMany({
        where: filtered,
        include: productInclude,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where: filtered }),
    ]);
    const cards = rows.map((row) => ({
      ...toCard(
        activeVariantsOnly ? { ...row, variants: row.variants.filter((v) => v.isActive) } : row,
        this.url,
      ),
      status: row.status,
    }));
    return pagedResult(await this.withRatings(cards), total, query);
  }

  /**
   * Ranks products for a search box query. With the search index ready, keyword and semantic
   * results are merged (ADR-0009); otherwise, and as a fallback, the original full-text search.
   */
  private async searchRank(q: string, status?: string): Promise<Map<string, number>> {
    if (
      this.config.get('SEARCH_MODE', { infer: true }) === 'hybrid' &&
      (await this.search.isReady())
    ) {
      const ranked = await this.search.hybrid(q, { status });
      if (ranked.size) return ranked;
    }
    return this.lexicalRank(q, status);
  }

  /** Full-text match over title, description, brand and specs; falls back to prefix matching. */
  private async lexicalRank(q: string, status?: string): Promise<Map<string, number>> {
    // Every word first ("32gb kestrel"), then any word for longer, conversational queries
    // ("quiet laptop for coding"), then a prefix match for half-typed words.
    const strict = await this.rankedSearch(q, status, false);
    if (strict.size) return strict;
    const loose = await this.rankedSearch(q, status, true);
    if (loose.size) return loose;

    // Typing in progress ("kest") does not match a full-text token yet.
    const fallback = await this.prisma.product.findMany({
      where: {
        ...(status ? { status: status as 'ACTIVE' } : {}),
        OR: [
          { title: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } },
          { variants: { some: { sku: { startsWith: q, mode: 'insensitive' } } } },
        ],
      },
      select: { id: true },
      take: MAX_CANDIDATES,
    });
    return new Map(fallback.map((row, index) => [row.id, 1 / (index + 1)]));
  }

  /** Weighted full-text match: title and brand (A), category and specs (B), description (C). */
  private async rankedSearch(
    q: string,
    status: string | undefined,
    anyWord: boolean,
  ): Promise<Map<string, number>> {
    const query = anyWord
      ? Prisma.sql`NULLIF(replace(plainto_tsquery('english', ${q})::text, '&', '|'), '')::tsquery`
      : Prisma.sql`websearch_to_tsquery('english', ${q})`;
    const rows = await this.prisma.$queryRaw<{ id: string; rank: number }[]>`
      WITH doc AS (
        SELECT p.id,
               setweight(to_tsvector('english', p.title), 'A') ||
               setweight(to_tsvector('english', coalesce(b.name, '')), 'A') ||
               setweight(to_tsvector('english', c.name), 'B') ||
               setweight(to_tsvector('english', p.attributes::text), 'B') ||
               setweight(to_tsvector('english', p.description), 'C') AS vector
        FROM products p
        LEFT JOIN brands b ON b.id = p.brand_id
        JOIN categories c ON c.id = p.category_id
        WHERE (${status ?? null}::text IS NULL OR p.status::text = ${status ?? null})
      )
      SELECT id::text AS id, ts_rank(vector, ${query})::float AS rank
      FROM doc
      WHERE vector @@ ${query}
      ORDER BY rank DESC
      LIMIT ${MAX_CANDIDATES}`;
    return new Map(rows.map((row) => [row.id, row.rank]));
  }

  private async categoryAndDescendantIds(slug: string): Promise<string[]> {
    const categories = await this.prisma.category.findMany({
      select: { id: true, slug: true, parentId: true },
    });
    const root = categories.find((category) => category.slug === slug);
    return root ? descendantIds(root.id, categories) : [];
  }

  /** Root first, ending with the category itself. One query for the whole (small) tree. */
  private async breadcrumb(category: Category): Promise<{ slug: string; name: string }[]> {
    if (!category.parentId) return [{ slug: category.slug, name: category.name }];
    const categories = await this.prisma.category.findMany({
      select: { id: true, parentId: true, slug: true, name: true },
    });
    const byId = new Map(categories.map((row) => [row.id, row]));
    byId.set(category.id, category);
    return [category, ...ancestorsOf(category.id, byId)]
      .reverse()
      .map(({ slug, name }) => ({ slug, name }));
  }

  /** Live product cards in the order given (wishlists, recommendations). */
  async cardsByIds(ids: string[]): Promise<ProductCard[]> {
    if (!ids.length) return [];
    const rows = await this.prisma.product.findMany({
      where: { id: { in: ids }, status: 'ACTIVE' },
      include: productInclude,
    });
    const byId = new Map(rows.map((row) => [row.id, row]));
    return this.withRatings(
      ids.flatMap((id) => {
        const row = byId.get(id);
        return row
          ? [toCard({ ...row, variants: row.variants.filter((v) => v.isActive) }, this.url)]
          : [];
      }),
    );
  }

  /** Adds each card's approved-review average and count, in one query. */
  private async withRatings<C extends ProductCard>(cards: C[]): Promise<C[]> {
    if (!cards.length) return cards;
    const rows = await this.prisma.review.groupBy({
      by: ['productId'],
      where: { productId: { in: cards.map((card) => card.id) }, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const byId = new Map(rows.map((row) => [row.productId, row]));
    return cards.map((card) => {
      const row = byId.get(card.id);
      const average = row?._avg.rating;
      return {
        ...card,
        rating: {
          average: average == null ? null : roundRating(average),
          count: row?._count._all ?? 0,
        },
      };
    });
  }

  private async toDetail(
    product: ProductWithRelations,
    activeVariantsOnly: boolean,
  ): Promise<ProductDetail> {
    const view = activeVariantsOnly
      ? { ...product, variants: product.variants.filter((variant) => variant.isActive) }
      : product;
    const rating = await this.prisma.review.aggregate({
      where: { productId: product.id, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    return {
      ...toCard(view, this.url),
      rating: {
        average: rating._avg.rating === null ? null : roundRating(rating._avg.rating),
        count: rating._count._all,
      },
      description: product.description,
      status: product.status,
      attributes: (product.attributes ?? {}) as Record<string, string | number | boolean>,
      breadcrumb: await this.breadcrumb(product.category),
      seller: product.seller
        ? {
            handle: product.seller.handle,
            displayName: product.seller.displayName,
            rating: ratingSummary(product.seller),
          }
        : null,
      // Review feedback is between staff and the seller; the storefront never shows it.
      reviewNote: activeVariantsOnly ? null : product.reviewNote,
      images: product.images.map((image) => toImage(image, this.url)),
      variants: view.variants.map(toVariant),
      createdAt: product.createdAt.toISOString(),
      updatedAt: product.updatedAt.toISOString(),
    };
  }
}

function emptyPage(query: { page: number; pageSize: number }): PagedResult<ProductCard> {
  return pagedResult([], 0, query);
}
