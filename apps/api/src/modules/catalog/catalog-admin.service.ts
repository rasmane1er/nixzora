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
  type ProductImageAttach,
  type ProductUpdate,
  slugify,
  type VariantCreate,
  type VariantUpdate,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { isNotFound, isUniqueViolation } from '../../common/prisma-errors';
import { type RequestMeta } from '../../common/request-meta';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { type AuthUser } from '../identity/auth-user';
import { StorageService } from '../media/storage.service';
import { CatalogQueryService } from './catalog-query.service';

type Actor = { user: AuthUser; meta: RequestMeta };

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
    private readonly storage: StorageService,
    private readonly query: CatalogQueryService,
  ) {}

  // ───────────── Categories ─────────────

  async createCategory(input: CategoryCreate, actor: Actor) {
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
      await this.record('catalog.category.created', 'category', category.id, actor, {
        slug: category.slug,
      });
      return category;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('A category with this slug already exists.');
      throw error;
    }
  }

  async updateCategory(id: string, input: CategoryUpdate, actor: Actor) {
    await this.requireCategory(id);
    if (input.parentId) {
      if (input.parentId === id)
        throw new BadRequestException('A category cannot be its own parent.');
      if (await this.isDescendant(input.parentId, id)) {
        throw new BadRequestException('A category cannot move under one of its own subcategories.');
      }
    }
    try {
      const category = await this.prisma.category.update({ where: { id }, data: input });
      await this.record('catalog.category.updated', 'category', id, actor, {
        changes: Object.keys(input),
      });
      return category;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('A category with this slug already exists.');
      throw error;
    }
  }

  async deleteCategory(id: string, actor: Actor): Promise<void> {
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
    await this.prisma.category.delete({ where: { id } });
    await this.record('catalog.category.deleted', 'category', id, actor);
  }

  // ───────────── Brands ─────────────

  async createBrand(input: BrandCreate, actor: Actor) {
    try {
      const brand = await this.prisma.brand.create({
        data: { name: input.name, slug: input.slug ?? slugify(input.name) },
      });
      await this.record('catalog.brand.created', 'brand', brand.id, actor, { slug: brand.slug });
      return brand;
    } catch (error) {
      if (isUniqueViolation(error))
        throw new ConflictException('A brand with this slug already exists.');
      throw error;
    }
  }

  async updateBrand(id: string, input: BrandUpdate, actor: Actor) {
    try {
      const brand = await this.prisma.brand.update({ where: { id }, data: input });
      await this.record('catalog.brand.updated', 'brand', id, actor, {
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

  async createProduct(input: ProductCreate, actor: Actor): Promise<ProductDetail> {
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
            variants: { create: input.variants.map((variant) => this.variantData(variant)) },
          },
        });
        await this.outbox(tx, 'catalog.product.created', created.id, {
          slug,
          status: created.status,
        });
        return created;
      });
      await this.record('catalog.product.created', 'product', product.id, actor, {
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

  async updateProduct(id: string, input: ProductUpdate, actor: Actor): Promise<ProductDetail> {
    const existing = await this.prisma.product.findUnique({
      where: { id },
      include: { variants: true },
    });
    if (!existing) throw new NotFoundException('Product not found.');
    if (input.categoryId) await this.requireCategory(input.categoryId);
    if (input.brandId) await this.requireBrand(input.brandId);
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
    await this.record(action, 'product', id, actor, { changes: Object.keys(input) });
    return this.query.productById(id);
  }

  async addVariant(productId: string, input: VariantCreate, actor: Actor): Promise<ProductDetail> {
    await this.requireProduct(productId);
    try {
      const variant = await this.prisma.$transaction(async (tx) => {
        const created = await tx.productVariant.create({
          data: { productId, ...this.variantData(input) },
        });
        await this.outbox(tx, 'catalog.product.updated', productId, { variantAdded: created.sku });
        return created;
      });
      await this.record('catalog.variant.created', 'variant', variant.id, actor, {
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
    actor: Actor,
  ): Promise<ProductDetail> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found.');

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
    await this.record('catalog.variant.updated', 'variant', variantId, actor, {
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
    actor: Actor,
  ): Promise<ProductDetail> {
    await this.requireProduct(productId);
    if (!(await this.storage.exists(input.storageKey))) {
      throw new BadRequestException('Upload the file first, then attach it.');
    }
    const position =
      input.position ?? (await this.prisma.productImage.count({ where: { productId } }));
    const image = await this.prisma.productImage.create({
      data: { productId, storageKey: input.storageKey, alt: input.alt, position },
    });
    await this.record('catalog.image.attached', 'product', productId, actor, { imageId: image.id });
    return this.query.productById(productId);
  }

  async removeImage(productId: string, imageId: string, actor: Actor): Promise<ProductDetail> {
    const { count } = await this.prisma.productImage.deleteMany({
      where: { id: imageId, productId },
    });
    if (!count) throw new NotFoundException('Image not found.');
    await this.record('catalog.image.removed', 'product', productId, actor, { imageId });
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

  private async availableSlug(base: string): Promise<string> {
    const taken = new Set(
      (
        await this.prisma.product.findMany({
          where: { slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((row) => row.slug),
    );
    if (!taken.has(base)) return base;
    for (let n = 2; ; n++) if (!taken.has(`${base}-${n}`)) return `${base}-${n}`;
  }

  private async isDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
    let current = await this.prisma.category.findUnique({ where: { id: candidateId } });
    for (let depth = 0; current && depth < 20; depth++) {
      if (current.parentId === ancestorId) return true;
      current = current.parentId
        ? await this.prisma.category.findUnique({ where: { id: current.parentId } })
        : null;
    }
    return false;
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

  private record(
    action: string,
    entityType: string,
    entityId: string,
    actor: Actor,
    metadata?: Record<string, unknown>,
  ) {
    return this.audit.record({
      action,
      actorType: 'ADMIN',
      actorId: actor.user.id,
      entityType,
      entityId,
      meta: actor.meta,
      metadata,
    });
  }
}
