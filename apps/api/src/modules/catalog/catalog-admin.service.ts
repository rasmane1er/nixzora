import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type BrandCreate,
  type BrandUpdate,
  type CategoryCreate,
  type CategoryUpdate,
  type ProductCreate,
  type ProductDetail,
  MAX_PRODUCT_IMAGES,
  MAX_PRODUCT_VIDEOS,
  parseVideoUrl,
  type ProductImageAttach,
  type ProductImageColor,
  productColors,
  type ProductVideoAdd,
  type ProductImageOrder,
  type ProductUpdate,
  slugify,
  type VariantCreate,
  type VariantUpdate,
} from '@nixzora/validation';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { type Prisma } from '../../generated/prisma/client';
import { isForeignKeyViolation, isNotFound, isUniqueViolation } from '../../common/prisma-errors';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { MediaIntakeService } from '../media/media-intake.service';
import { CatalogQueryService } from './catalog-query.service';
import { lookUpVideo } from './video-info';
import { ancestorsOf } from './category-tree';

/**
 * Write side of the catalog, used by the Ops Center.
 * Every change is audited, and product changes also write an outbox event so the
 * search index (Phase 6) and caches can follow without coupling to this module.
 */
@Injectable()
export class CatalogAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly intake: MediaIntakeService,
    private readonly query: CatalogQueryService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  // ───────────── Categories ─────────────

  async createCategory(input: CategoryCreate, actor: ActorContext) {
    if (input.parentId) await this.requireCategory(input.parentId);
    try {
      const category = await this.prisma.category.create({
        data: {
          name: input.name,
          slug: input.slug ?? slugify(input.name),
          parentId: input.parentId ?? null,
          description: input.description ?? null,
          position: input.position ?? 0,
          isActive: input.isActive ?? true,
        },
      });
      await this.audit.recordFor(actor, 'catalog.category.created', 'category', category.id, {
        slug: category.slug,
      });
      return category;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('A category with this slug already exists.');
      throw error;
    }
  }

  async updateCategory(id: string, input: CategoryUpdate, actor: ActorContext) {
    await this.requireCategory(id);
    if (input.parentId) {
      if (input.parentId === id)
        throw new BadRequestException('A category cannot be its own parent.');
      await this.requireCategory(input.parentId);
      if (await this.isDescendant(input.parentId, id)) {
        throw new BadRequestException('A category cannot move under one of its own subcategories.');
      }
    }
    try {
      const category = await this.prisma.category.update({ where: { id }, data: input });
      await this.audit.recordFor(actor, 'catalog.category.updated', 'category', id, {
        changes: Object.keys(input),
      });
      return category;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('A category with this slug already exists.');
      if (isForeignKeyViolation(error))
        throw new BadRequestException('That parent category no longer exists.');
      throw error;
    }
  }

  async deleteCategory(id: string, actor: ActorContext): Promise<void> {
    await this.requireCategory(id);
    const [children, products] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id } }),
    ]);
    if (children || products) {
      throw new ConflictException(
        `Move its ${products} product(s) and ${children} subcategory(ies) first, or deactivate it instead.`,
      );
    }
    try {
      await this.prisma.category.delete({ where: { id } });
    } catch (error) {
      // A product or subcategory was added since the count above.
      if (isForeignKeyViolation(error))
        throw new ConflictException(
          'Something was just added to this category. Reload and try again.',
        );
      throw error;
    }
    await this.audit.recordFor(actor, 'catalog.category.deleted', 'category', id);
  }

  // ───────────── Brands ─────────────

  async createBrand(input: BrandCreate, actor: ActorContext) {
    try {
      const brand = await this.prisma.brand.create({
        data: { name: input.name, slug: input.slug ?? slugify(input.name) },
      });
      await this.audit.recordFor(actor, 'catalog.brand.created', 'brand', brand.id, {
        slug: brand.slug,
      });
      return brand;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('A brand with this slug already exists.');
      throw error;
    }
  }

  async updateBrand(id: string, input: BrandUpdate, actor: ActorContext) {
    try {
      const brand = await this.prisma.brand.update({ where: { id }, data: input });
      await this.audit.recordFor(actor, 'catalog.brand.updated', 'brand', id, {
        changes: Object.keys(input),
      });
      return brand;
    } catch (error) {
      if (isNotFound(error)) throw new NotFoundException('Brand not found.');
      if (isUniqueViolation(error))
        throw new ConflictException('A brand with this slug already exists.');
      throw error;
    }
  }

  // ───────────── Products and variants ─────────────

  /** `sellerId` makes it a marketplace listing owned by that seller (ADR-0012). */
  async createProduct(
    input: ProductCreate,
    actor: ActorContext,
    options: { sellerId?: string } = {},
  ): Promise<ProductDetail> {
    await this.requireCategory(input.categoryId);
    if (input.brandId) await this.requireBrand(input.brandId);
    if (input.status === 'ACTIVE' && !input.variants.some((v) => v.isActive !== false)) {
      throw new BadRequestException('An active product needs at least one active variant.');
    }
    this.assertUniqueSkus(input.variants);

    const slug = input.slug ?? (await this.availableSlug(slugify(input.title)));
    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const created = await tx.product.create({
          data: {
            slug,
            title: input.title,
            description: input.description,
            status: input.status,
            categoryId: input.categoryId,
            brandId: input.brandId ?? null,
            attributes: input.attributes as Prisma.InputJsonObject,
            sellerId: options.sellerId ?? null,
            variants: { create: input.variants.map((variant) => this.variantData(variant)) },
          },
        });
        await this.outbox(tx, 'catalog.product.created', created.id, {
          slug,
          status: created.status,
        });
        return created;
      });
      await this.audit.recordFor(actor, 'catalog.product.created', 'product', product.id, {
        slug,
        variants: input.variants.length,
      });
      return this.query.productById(product.id);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'That slug, or one of these SKUs or barcodes, is already in use.',
        );
      }
      throw error;
    }
  }

  async updateProduct(
    id: string,
    input: ProductUpdate,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!existing) throw new NotFoundException('Product not found.');
    if (input.categoryId) await this.requireCategory(input.categoryId);
    if (input.brandId) await this.requireBrand(input.brandId);
    // Size & fit guide (p10-26): the store's own chart or one of NIXZORA's, never another store's.
    if (input.sizeChartId) {
      const chart = await this.prisma.sizeChart.findUnique({ where: { id: input.sizeChartId } });
      if (!chart || (chart.sellerId !== null && chart.sellerId !== existing.sellerId)) {
        throw new BadRequestException('Choose one of your size charts.');
      }
    }
    if (input.status === 'ACTIVE' && !existing.variants.some((variant) => variant.isActive)) {
      throw new BadRequestException('Add or activate a variant before publishing this product.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.product.update({
          where: { id },
          data: {
            ...input,
            attributes: input.attributes as Prisma.InputJsonObject | undefined,
          },
        });
        await this.outbox(tx, 'catalog.product.updated', id, { changes: Object.keys(input) });
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('A product with this slug already exists.');
      throw error;
    }

    const action =
      input.status && input.status !== existing.status
        ? `catalog.product.${input.status === 'ACTIVE' ? 'published' : input.status === 'ARCHIVED' ? 'archived' : 'unpublished'}`
        : 'catalog.product.updated';
    await this.audit.recordFor(actor, action, 'product', id, { changes: Object.keys(input) });
    return this.query.productById(id);
  }

  async addVariant(
    productId: string,
    input: VariantCreate,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.requireProduct(productId);
    try {
      const variant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.productVariant.create({
          data: { productId, ...this.variantData(input) },
        });
        await this.outbox(tx, 'catalog.product.updated', productId, { variantAdded: created.sku });
        return created;
      });
      await this.audit.recordFor(actor, 'catalog.variant.created', 'variant', variant.id, {
        sku: variant.sku,
        productId,
      });
      return this.query.productById(productId);
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('That SKU or barcode is already in use.');
      throw error;
    }
  }

  async updateVariant(
    variantId: string,
    input: VariantUpdate,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found.');

    // A live deal owns the price until it ends (p10-07): it restores the regular price then.
    if (input.priceCents !== undefined || input.compareAtCents !== undefined) {
      const deal = await this.prisma.deal.findFirst({
        where: { productId: variant.productId, status: 'LIVE' },
        select: { endsAt: true },
      });
      if (deal) {
        throw new ConflictException(
          `A deal is running on this product until ${deal.endsAt.toISOString().slice(0, 16).replace('T', ' ')} UTC. Change the price after it ends, or cancel the deal.`,
        );
      }
    }

    const price = input.priceCents ?? variant.priceCents;
    const compareAt =
      input.compareAtCents === undefined ? variant.compareAtCents : input.compareAtCents;
    if (compareAt != null && compareAt <= price) {
      throw new BadRequestException('The "was" price must be higher than the price.');
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.productVariant.update({
          where: { id: variantId },
          data: { ...input, options: input.options as Prisma.InputJsonObject | undefined },
        });
        await this.outbox(tx, 'catalog.product.updated', variant.productId, {
          variantUpdated: variant.sku,
        });
      });
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('That barcode belongs to another variant.');
      throw error;
    }
    await this.audit.recordFor(actor, 'catalog.variant.updated', 'variant', variantId, {
      sku: variant.sku,
      changes: Object.keys(input),
      ...(input.priceCents !== undefined
        ? { priceFrom: variant.priceCents, priceTo: input.priceCents }
        : {}),
    });
    return this.query.productById(variant.productId);
  }

  // ───────────── Images ─────────────

  async attachImage(
    productId: string,
    input: ProductImageAttach,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.requireProduct(productId);
    if (!(await this.intake.ensureReady(input.storageKey))) {
      throw new BadRequestException('Upload the file first, then attach it.');
    }
    const image = await this.prisma.$transaction(async (tx) => {
      // Locks the product row so parallel uploads can't pass the limit or share a position.
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
      const existing = await tx.productImage.aggregate({
        where: { productId },
        _count: { _all: true },
        _max: { position: true },
      });
      if (existing._count._all >= MAX_PRODUCT_IMAGES) {
        throw new ConflictException(`A product can have up to ${MAX_PRODUCT_IMAGES} photos.`);
      }
      const position = input.position ?? (existing._max.position ?? -1) + 1;
      const created = await tx.productImage.create({
        data: { productId, storageKey: input.storageKey, alt: input.alt, position },
      });
      // Search and cards show the main photo, so they need to hear about it.
      await this.outbox(tx, 'catalog.product.updated', productId, { imageAdded: created.id });
      return created;
    });
    await this.audit.recordFor(actor, 'catalog.image.attached', 'product', productId, {
      imageId: image.id,
    });
    return this.query.productById(productId);
  }

  /** Puts the photos in the given order; every photo of the product must be listed once. */
  async reorderImages(
    productId: string,
    input: ProductImageOrder,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.requireProduct(productId);
    const images = await this.prisma.productImage.findMany({
      where: { productId },
      select: { id: true },
    });
    const ids = new Set(images.map((image) => image.id));
    if (
      input.imageIds.length !== ids.size ||
      new Set(input.imageIds).size !== ids.size ||
      !input.imageIds.every((id) => ids.has(id))
    ) {
      throw new BadRequestException('List every photo of this product exactly once.');
    }
    await this.prisma.$transaction(async (tx) => {
      for (const [position, id] of input.imageIds.entries()) {
        await tx.productImage.update({ where: { id }, data: { position } });
      }
      await this.outbox(tx, 'catalog.product.updated', productId, { imagesReordered: true });
    });
    await this.audit.recordFor(actor, 'catalog.image.reordered', 'product', productId, {
      order: input.imageIds,
    });
    return this.query.productById(productId);
  }

  /** Photos per color (p10-29): which of the product's colors a photo shows, or none. */
  async setImageColor(
    productId: string,
    imageId: string,
    input: ProductImageColor,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        variants: { select: { options: true, isActive: true } },
        images: { where: { id: imageId }, select: { id: true } },
      },
    });
    if (!product?.images.length) throw new NotFoundException('Image not found.');
    if (input.color !== null) {
      const colors = productColors(
        product.variants.map((v) => ({
          options: (v.options ?? {}) as Record<string, string>,
          isActive: v.isActive,
        })),
      );
      if (!colors.includes(input.color)) {
        throw new BadRequestException(
          colors.length
            ? `Choose one of this product's colors: ${colors.join(', ')}.`
            : 'This product has no colors to choose from.',
        );
      }
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.productImage.update({ where: { id: imageId }, data: { color: input.color } });
      // Cards show each color's photo, so search and lists need to hear about it.
      await this.outbox(tx, 'catalog.product.updated', productId, { imageColor: imageId });
    });
    await this.audit.recordFor(actor, 'catalog.image.color_set', 'product', productId, {
      imageId,
      color: input.color,
    });
    return this.query.productById(productId);
  }

  async removeImage(
    productId: string,
    imageId: string,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    const count = await this.prisma.$transaction(async (tx) => {
      const { count } = await tx.productImage.deleteMany({ where: { id: imageId, productId } });
      if (count) {
        await this.outbox(tx, 'catalog.product.updated', productId, { imageRemoved: imageId });
      }
      return count;
    });
    if (!count) throw new NotFoundException('Image not found.');
    await this.audit.recordFor(actor, 'catalog.image.removed', 'product', productId, { imageId });
    return this.query.productById(productId);
  }

  // ───────────── Videos (p10-28) ─────────────

  /** Adds a YouTube or Vimeo video; the provider is asked for its title and still. */
  async addVideo(
    productId: string,
    input: ProductVideoAdd,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.requireProduct(productId);
    const parsed = parseVideoUrl(input.url);
    if (!parsed) throw new BadRequestException('Paste a YouTube or Vimeo link to the video.');
    const info =
      this.config.get('VIDEO_LOOKUP', { infer: true }) === 'oembed'
        ? await lookUpVideo(parsed)
        : ({ ok: true, title: null, thumbnailUrl: null } as const);
    if (!info.ok) {
      throw new BadRequestException(
        'That video is private, removed, or can’t be played on other sites. Make it public (or unlisted) and allow embedding, then try again.',
      );
    }
    const video = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
      const existing = await tx.productVideo.findMany({
        where: { productId },
        select: { provider: true, videoId: true, position: true },
      });
      if (existing.some((v) => v.provider === parsed.provider && v.videoId === parsed.videoId)) {
        throw new ConflictException('This video is already on the listing.');
      }
      if (existing.length >= MAX_PRODUCT_VIDEOS) {
        throw new ConflictException(`A product can have up to ${MAX_PRODUCT_VIDEOS} videos.`);
      }
      return tx.productVideo.create({
        data: {
          productId,
          provider: parsed.provider,
          videoId: parsed.videoId,
          title: input.title ?? info.title ?? 'Video',
          thumbnailUrl: info.thumbnailUrl,
          position: Math.max(-1, ...existing.map((v) => v.position)) + 1,
        },
      });
    });
    await this.audit.recordFor(actor, 'catalog.video.added', 'product', productId, {
      videoId: video.id,
      provider: video.provider,
    });
    return this.query.productById(productId);
  }

  async removeVideo(
    productId: string,
    videoId: string,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    const { count } = await this.prisma.productVideo.deleteMany({
      where: { id: videoId, productId },
    });
    if (!count) throw new NotFoundException('Video not found.');
    await this.audit.recordFor(actor, 'catalog.video.removed', 'product', productId, { videoId });
    return this.query.productById(productId);
  }

  // ───────────── Helpers ─────────────

  private variantData(variant: VariantCreate) {
    return {
      sku: variant.sku,
      barcode: variant.barcode ?? null,
      title: variant.title,
      options: variant.options as Prisma.InputJsonObject,
      priceCents: variant.priceCents,
      compareAtCents: variant.compareAtCents ?? null,
      weightGrams: variant.weightGrams ?? null,
      isActive: variant.isActive ?? true,
      inventory: { create: { onHand: variant.initialStock ?? 0 } },
    };
  }

  private assertUniqueSkus(variants: VariantCreate[]): void {
    const skus = variants.map((variant) => variant.sku);
    const duplicate = skus.find((sku, index) => skus.indexOf(sku) !== index);
    if (duplicate) throw new BadRequestException(`SKU ${duplicate} is listed twice.`);
  }

  /** `base`, or `base-2`, `base-3`… Reads only those slugs (not every slug starting with base). */
  private async availableSlug(base: string): Promise<string> {
    const pattern = `^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-[0-9]+$`;
    const rows = await this.prisma.$queryRaw<{ slug: string }[]>`
      SELECT slug FROM products WHERE slug = ${base} OR slug ~ ${pattern}`;
    const taken = new Set(rows.map((row) => row.slug));
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }

  private async isDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
    const categories = await this.prisma.category.findMany({
      select: { id: true, parentId: true },
    });
    const byId = new Map(categories.map((category) => [category.id, category]));
    return ancestorsOf(candidateId, byId).some((category) => category.id === ancestorId);
  }

  private async requireCategory(id: string): Promise<void> {
    if (!(await this.prisma.category.findUnique({ where: { id }, select: { id: true } }))) {
      throw new BadRequestException('That category does not exist.');
    }
  }

  private async requireBrand(id: string): Promise<void> {
    if (!(await this.prisma.brand.findUnique({ where: { id }, select: { id: true } }))) {
      throw new BadRequestException('That brand does not exist.');
    }
  }

  private async requireProduct(id: string): Promise<void> {
    if (!(await this.prisma.product.findUnique({ where: { id }, select: { id: true } }))) {
      throw new NotFoundException('Product not found.');
    }
  }

  private outbox(
    tx: Prisma.TransactionClient,
    type: string,
    productId: string,
    payload: Record<string, unknown>,
  ) {
    return tx.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: productId,
        type,
        payload: { productId, ...payload } as Prisma.InputJsonObject,
      },
    });
  }
}
