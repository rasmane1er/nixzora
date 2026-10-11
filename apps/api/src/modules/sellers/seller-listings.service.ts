import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  type InventoryAdjust,
  type PagedResult,
  pagedResult,
  type ProductCopySuggestion,
  type ProductDetail,
  type ProductImageAttach,
  type ProductImageColor,
  type ProductVideoAdd,
  type ProductImageOrder,
  type SellerProductCreate,
  type SellerProductListQuery,
  type SellerProductRow,
  type SellerProductUpdate,
  type UploadRequest,
  type UploadTicket,
  type VariantCreate,
  type VariantUpdate,
} from '@nixzora/validation';
import { type ProductStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { CatalogAdminService } from '../catalog/catalog-admin.service';
import { productInclude } from '../catalog/catalog-mappers';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { ProductCopyService } from '../insights/product-copy.service';
import { InventoryService } from '../inventory/inventory.service';
import { StorageService } from '../media/storage.service';
import { toListingRow } from './seller-mappers';
import { SellersService } from './sellers.service';

/** Edits that change what shoppers read: on a live listing they send it back to review. */
const CONTENT_FIELDS = ['title', 'description', 'categoryId', 'brandId', 'attributes'] as const;

/** Order-insensitive comparison for JSON specs; plain equality for the rest. */
function sameValue(a: unknown, b: unknown): boolean {
  const canonical = (value: unknown): string =>
    value && typeof value === 'object' && !Array.isArray(value)
      ? JSON.stringify(
          Object.fromEntries(
            Object.entries(value as Record<string, unknown>).sort(([x], [y]) => x.localeCompare(y)),
          ),
        )
      : JSON.stringify(value ?? null);
  return canonical(a) === canonical(b);
}

/**
 * A seller's own listings (p7-03). Writes reuse the catalog services so the rules (unique SKUs,
 * valid prices, search indexing through the outbox) are the same as for NIXZORA's products;
 * this layer adds ownership and the review workflow: draft → pending review → live.
 */
@Injectable()
export class SellerListingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly sellers: SellersService,
    private readonly catalog: CatalogAdminService,
    private readonly query: CatalogQueryService,
    private readonly inventory: InventoryService,
    private readonly storage: StorageService,
    private readonly copy: ProductCopyService,
    private readonly redis: RedisService,
  ) {}

  /**
   * AI listing assistant (p7-09): a description drafted from the listing's own specs, with every
   * number checked against them. Never saved; the seller edits and saves it. 30 drafts per store
   * per day keep one store from spending the shared AI budget.
   */
  async suggestCopy(productId: string, actor: ActorContext): Promise<ProductCopySuggestion> {
    const { seller } = await this.sellers.require(actor.user.id, { write: true });
    await this.owned(productId, actor);
    const key = `copy:seller:${seller.id}:${new Date().toISOString().slice(0, 10)}`;
    const used = await this.redis.client
      .multi()
      .incr(key)
      .expire(key, 2 * 86_400)
      .exec()
      .then((replies) => Number(replies?.[0]?.[1] ?? 0))
      .catch(() => 0);
    if (used > 30) {
      throw new HttpException(
        "You have used today's 30 description drafts. Try again tomorrow.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    return this.copy.suggest(productId);
  }

  async list(
    query: SellerProductListQuery,
    actor: ActorContext,
  ): Promise<PagedResult<SellerProductRow>> {
    const { seller } = await this.sellers.require(actor.user.id);
    const where = { sellerId: seller.id, ...(query.status ? { status: query.status } : {}) };
    const [total, rows] = await Promise.all([
      this.prisma.product.count({ where }),
      this.prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
    ]);
    return pagedResult(
      rows.map((row) => toListingRow(row, (key) => this.storage.publicUrl(key))),
      total,
      query,
    );
  }

  async get(productId: string, actor: ActorContext): Promise<ProductDetail> {
    await this.owned(productId, actor);
    return this.query.productById(productId);
  }

  async create(input: SellerProductCreate, actor: ActorContext): Promise<ProductDetail> {
    const { seller } = await this.sellers.require(actor.user.id, { write: true });
    return this.catalog.createProduct({ ...input, status: 'DRAFT' }, this.as(actor), {
      sellerId: seller.id,
    });
  }

  async update(
    productId: string,
    input: SellerProductUpdate,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    const product = await this.owned(productId, actor, { write: true });
    let backToReview = false;
    if (product.status === 'ACTIVE') {
      const current = await this.prisma.product.findUniqueOrThrow({
        where: { id: productId },
        select: {
          title: true,
          description: true,
          categoryId: true,
          brandId: true,
          attributes: true,
        },
      });
      // Forms send every field; only a real change to what shoppers read needs a new review.
      backToReview = CONTENT_FIELDS.some(
        (field) => input[field] !== undefined && !sameValue(input[field], current[field] ?? null),
      );
    }
    return this.catalog.updateProduct(
      productId,
      { ...input, ...(backToReview ? { status: 'PENDING_REVIEW' as const } : {}) },
      this.as(actor),
    );
  }

  async addVariant(
    productId: string,
    input: VariantCreate,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.owned(productId, actor, { write: true });
    return this.catalog.addVariant(productId, input, this.as(actor));
  }

  async updateVariant(
    variantId: string,
    input: VariantUpdate,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.ownedVariant(variantId, actor);
    return this.catalog.updateVariant(variantId, input, this.as(actor));
  }

  async adjustStock(variantId: string, input: InventoryAdjust, actor: ActorContext) {
    await this.ownedVariant(variantId, actor);
    return this.inventory.adjust(variantId, input, this.as(actor));
  }

  async createUpload(input: UploadRequest, actor: ActorContext): Promise<UploadTicket> {
    await this.sellers.require(actor.user.id, { write: true });
    return this.storage.createUpload(input.contentType, input.sizeBytes);
  }

  async attachImage(
    productId: string,
    input: ProductImageAttach,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    const product = await this.owned(productId, actor, { write: true });
    await this.catalog.attachImage(productId, input, this.as(actor));
    // A new photo is new content: a live listing goes back to review.
    if (product.status === 'ACTIVE') {
      await this.setStatus(productId, 'PENDING_REVIEW', actor, 'catalog.listing.resubmitted');
    }
    return this.query.productById(productId);
  }

  /** Product videos (p10-28): a new video is new content, so a live listing goes back to review. */
  async addVideo(
    productId: string,
    input: ProductVideoAdd,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    const product = await this.owned(productId, actor, { write: true });
    await this.catalog.addVideo(productId, input, this.as(actor));
    if (product.status === 'ACTIVE') {
      await this.setStatus(productId, 'PENDING_REVIEW', actor, 'catalog.listing.resubmitted');
    }
    return this.query.productById(productId);
  }

  async removeVideo(
    productId: string,
    videoId: string,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.owned(productId, actor, { write: true });
    return this.catalog.removeVideo(productId, videoId, this.as(actor));
  }

  /** Photos per color (p10-29): tagging a photo changes no content, so no new review. */
  async setImageColor(
    productId: string,
    imageId: string,
    input: ProductImageColor,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.owned(productId, actor, { write: true });
    return this.catalog.setImageColor(productId, imageId, input, this.as(actor));
  }

  async reorderImages(
    productId: string,
    input: ProductImageOrder,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.owned(productId, actor, { write: true });
    return this.catalog.reorderImages(productId, input, this.as(actor));
  }

  async removeImage(
    productId: string,
    imageId: string,
    actor: ActorContext,
  ): Promise<ProductDetail> {
    await this.owned(productId, actor, { write: true });
    return this.catalog.removeImage(productId, imageId, this.as(actor));
  }

  /** Draft → pending review. Staff approve or send it back with a note. */
  async submit(productId: string, actor: ActorContext): Promise<ProductDetail> {
    const { seller } = await this.sellers.require(actor.user.id, { write: true });
    if (seller.status !== 'ACTIVE') {
      throw new ForbiddenException(
        'Your store is waiting for approval. You can submit listings once it is approved.',
      );
    }
    const product = await this.owned(productId, actor, { write: true });
    if (product.status === 'PENDING_REVIEW' || product.status === 'ACTIVE') {
      throw new ConflictException(
        product.status === 'ACTIVE' ? 'This listing is already live.' : 'Already submitted.',
      );
    }
    const [variants, images] = await Promise.all([
      this.prisma.productVariant.count({ where: { productId, isActive: true } }),
      this.prisma.productImage.count({ where: { productId } }),
    ]);
    if (!variants) throw new BadRequestException('Add at least one active variant first.');
    if (!images) throw new BadRequestException('Add at least one photo first.');
    await this.setStatus(productId, 'PENDING_REVIEW', actor, 'catalog.listing.submitted', {
      reviewNote: null,
    });
    return this.query.productById(productId);
  }

  /** Takes a live or pending listing off the store; it returns to draft. */
  async withdraw(productId: string, actor: ActorContext): Promise<ProductDetail> {
    const product = await this.owned(productId, actor);
    if (product.status !== 'ACTIVE' && product.status !== 'PENDING_REVIEW') {
      throw new ConflictException('This listing is not live or waiting for review.');
    }
    await this.setStatus(productId, 'DRAFT', actor, 'catalog.listing.withdrawn');
    return this.query.productById(productId);
  }

  // ───────────── Helpers ─────────────

  private as(actor: ActorContext): ActorContext {
    return { ...actor, actorType: 'USER' };
  }

  /** The product, if it belongs to the caller's store. Others' products read as not found. */
  private async owned(productId: string, actor: ActorContext, need: { write?: boolean } = {}) {
    const { seller } = await this.sellers.require(actor.user.id, need);
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerId: seller.id },
      select: { id: true, status: true },
    });
    if (!product) throw new NotFoundException('Listing not found.');
    return product;
  }

  private async ownedVariant(variantId: string, actor: ActorContext): Promise<void> {
    const { seller } = await this.sellers.require(actor.user.id, { write: true });
    const variant = await this.prisma.productVariant.findFirst({
      where: { id: variantId, product: { sellerId: seller.id } },
      select: { id: true },
    });
    if (!variant) throw new NotFoundException('Variant not found.');
  }

  private async setStatus(
    productId: string,
    status: ProductStatus,
    actor: ActorContext,
    action: string,
    extra: { reviewNote?: string | null } = {},
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.product.update({ where: { id: productId }, data: { status, ...extra } }),
      this.prisma.outboxEvent.create({
        data: {
          aggregateType: 'product',
          aggregateId: productId,
          type: 'catalog.product.updated',
          payload: { productId, changes: ['status'], status },
        },
      }),
    ]);
    await this.audit.record({
      action,
      actorType: 'USER',
      actorId: actor.user.id,
      entityType: 'product',
      entityId: productId,
      meta: actor.meta,
      metadata: { status },
    });
  }
}
