import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { type Cart, type CartLine, deliveryWindow, OWN_HANDLING_DAYS } from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { availableOf } from '../catalog/catalog-mappers';
import { StorageService } from '../media/storage.service';
import { CouponsService } from '../promotions/coupons.service';
import { PricingService } from './pricing.service';

/** Whose cart: a signed-in customer's, or a guest's opaque id. */
export type CartOwner = { userId: string } | { guestId: string };

const TTL_SECONDS = 30 * 24 * 3600;
const MAX_LINES = 50;
const MAX_QUANTITY = 20;
/** The applied coupon code lives in the cart hash under this field. */
const COUPON_FIELD = '__coupon';

/**
 * Carts live in Redis as a hash of variantId → quantity. Prices are never stored in the cart:
 * every read re-prices from the catalog, so a cart can't carry a stale or tampered price.
 */
@Injectable()
export class CartService {
  constructor(
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly storage: StorageService,
    private readonly coupons: CouponsService,
  ) {}

  static newGuestId(): string {
    return randomBytes(32).toString('base64url');
  }

  private key(owner: CartOwner): string {
    return 'userId' in owner ? `cart:u:${owner.userId}` : `cart:g:${owner.guestId}`;
  }

  async quantities(owner: CartOwner): Promise<Map<string, number>> {
    const raw = await this.run(() => this.redis.client.hgetall(this.key(owner)));
    return new Map(
      Object.entries(raw)
        .map(([variantId, qty]) => [variantId, Number(qty)] as const)
        .filter(([, qty]) => Number.isInteger(qty) && qty > 0),
    );
  }

  async add(owner: CartOwner, variantId: string, quantity: number): Promise<Cart> {
    await this.assertSellable(variantId);
    const current = await this.quantities(owner);
    if (!current.has(variantId) && current.size >= MAX_LINES) {
      throw new BadRequestException(`A cart can hold up to ${MAX_LINES} different items.`);
    }
    const next = Math.min(MAX_QUANTITY, (current.get(variantId) ?? 0) + quantity);
    await this.write(owner, variantId, next);
    return this.view(owner);
  }

  async setQuantity(owner: CartOwner, variantId: string, quantity: number): Promise<Cart> {
    if (quantity === 0) {
      await this.run(() => this.redis.client.hdel(this.key(owner), variantId));
    } else {
      const current = await this.quantities(owner);
      if (!current.has(variantId)) throw new NotFoundException('That item is not in your cart.');
      await this.write(owner, variantId, quantity);
    }
    return this.view(owner);
  }

  async clear(owner: CartOwner): Promise<void> {
    await this.run(() => this.redis.client.del(this.key(owner)));
  }

  /** After sign-in: the guest cart's items move into the account cart (quantities add up). */
  async merge(userId: string, guestId: string): Promise<Cart> {
    const guest: CartOwner = { guestId };
    const user: CartOwner = { userId };
    const [guestItems, userItems] = await Promise.all([
      this.quantities(guest),
      this.quantities(user),
    ]);
    for (const [variantId, qty] of guestItems) {
      const merged = Math.min(MAX_QUANTITY, (userItems.get(variantId) ?? 0) + qty);
      await this.write(user, variantId, merged);
    }
    const [guestCoupon, userCoupon] = await Promise.all([
      this.couponCode(guest),
      this.couponCode(user),
    ]);
    if (guestCoupon && !userCoupon) await this.write(user, COUPON_FIELD, guestCoupon);
    await this.clear(guest);
    return this.view(user);
  }

  empty(): Cart {
    return { cartId: null, lines: [], itemCount: 0, totals: this.pricing.totals(0), coupon: null };
  }

  async couponCode(owner: CartOwner): Promise<string | null> {
    return this.run(() => this.redis.client.hget(this.key(owner), COUPON_FIELD));
  }

  /** Applies a code if it is valid for the cart as it is now; otherwise explains why not. */
  async applyCoupon(owner: CartOwner, code: string): Promise<Cart> {
    const current = await this.view(owner);
    const check = await this.coupons.check(code, current.totals.subtotalCents);
    if (!check.ok) throw new BadRequestException(check.problem);
    await this.write(owner, COUPON_FIELD, check.coupon.code);
    return this.view(owner);
  }

  async removeCoupon(owner: CartOwner): Promise<Cart> {
    await this.run(() => this.redis.client.hdel(this.key(owner), COUPON_FIELD));
    return this.view(owner);
  }

  /** The cart priced from the live catalog, with stock problems flagged per line. */
  async view(owner: CartOwner, region?: string | null): Promise<Cart> {
    const quantities = await this.quantities(owner);
    const variants = quantities.size
      ? await this.prisma.productVariant.findMany({
          where: { id: { in: [...quantities.keys()] } },
          include: {
            inventory: true,
            product: {
              include: {
                images: { orderBy: { position: 'asc' }, take: 1 },
                seller: { select: { handlingDays: true } },
              },
            },
          },
        })
      : [];
    const byId = new Map(variants.map((variant) => [variant.id, variant]));

    const lines: CartLine[] = [];
    for (const [variantId, quantity] of quantities) {
      const variant = byId.get(variantId);
      if (!variant) {
        // Deleted from the catalog: drop it silently.
        await this.run(() => this.redis.client.hdel(this.key(owner), variantId));
        continue;
      }
      const available = availableOf(variant.inventory);
      const sellable = variant.isActive && variant.product.status === 'ACTIVE';
      const image = variant.product.images[0];
      lines.push({
        variantId,
        productId: variant.productId,
        productSlug: variant.product.slug,
        productTitle: variant.product.title,
        variantTitle: variant.title,
        sku: variant.sku,
        options: (variant.options ?? {}) as Record<string, string>,
        imageUrl: image ? this.storage.publicUrl(image.storageKey) : null,
        unitPriceCents: variant.priceCents,
        compareAtCents: variant.compareAtCents,
        quantity,
        lineTotalCents: variant.priceCents * quantity,
        available,
        problem:
          !sellable || available === 0
            ? 'UNAVAILABLE'
            : available < quantity
              ? 'INSUFFICIENT_STOCK'
              : null,
      });
    }
    lines.sort((a, b) => a.productTitle.localeCompare(b.productTitle));

    const subtotal = lines
      .filter((line) => line.problem !== 'UNAVAILABLE')
      .reduce((sum, line) => sum + line.lineTotalCents, 0);

    // A coupon that stops applying (expired, cart too small) stays visible with the reason.
    const code = await this.couponCode(owner);
    const check = code ? await this.coupons.check(code, subtotal) : null;
    // The slowest store in the cart decides when everything has arrived (p10-04).
    const buyable = variants.filter(
      (v) => byId.has(v.id) && v.isActive && availableOf(v.inventory) > 0,
    );
    const handling = Math.max(
      0,
      ...buyable.map((v) => v.product.seller?.handlingDays ?? OWN_HANDLING_DAYS),
    );
    return {
      delivery: buyable.length ? deliveryWindow(new Date(), handling) : null,
      cartId: 'guestId' in owner ? owner.guestId : null,
      lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      totals: this.pricing.totals(subtotal, region, check?.ok ? check.discountCents : 0),
      coupon:
        code && check
          ? {
              code,
              description: check.coupon?.description ?? null,
              problem: check.ok ? null : check.problem,
            }
          : null,
    };
  }

  private async assertSellable(variantId: string): Promise<void> {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: { select: { status: true } }, inventory: true },
    });
    if (!variant || !variant.isActive || variant.product.status !== 'ACTIVE') {
      throw new NotFoundException('That product is not available.');
    }
    if (availableOf(variant.inventory) === 0) {
      throw new BadRequestException('That item is sold out.');
    }
  }

  private async write(
    owner: CartOwner,
    variantId: string,
    quantity: number | string,
  ): Promise<void> {
    const key = this.key(owner);
    await this.run(() =>
      this.redis.client.multi().hset(key, variantId, quantity).expire(key, TTL_SECONDS).exec(),
    );
  }

  private async run<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch {
      throw new ServiceUnavailableException(
        'Your cart is temporarily unavailable. Try again in a moment.',
      );
    }
  }
}
