import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  type Cart,
  type CartLine,
  deliveryWindow,
  GIFT_WRAP_CENTS,
  OWN_HANDLING_DAYS,
  twoDayWindow,
} from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { PlusBenefits } from '../plus/plus-benefits.service';
import { type BundleSaving, bundleSavings } from './bundle-savings';

export type ClippedSaving = {
  id: string;
  clipId: string;
  productId: string;
  productTitle: string;
  discountCents: number;
  sellerId: string | null;
};
import { availableOf } from '../catalog/catalog-mappers';
import { StorageService } from '../media/storage.service';
import { CouponsService } from '../promotions/coupons.service';
import { PricingService } from './pricing.service';

/**
 * Whose cart: a signed-in customer's, a guest's opaque id, or a one-off "Buy now" cart (p10-05)
 * that holds the single item being bought right away and leaves the main cart untouched.
 */
export type CartOwner = { userId: string } | { guestId: string } | { buyNowId: string };

const TTL_SECONDS = 30 * 24 * 3600;
const MAX_LINES = 50;
const MAX_QUANTITY = 20;
/** The applied coupon code lives in the cart hash under this field. */
const COUPON_FIELD = '__coupon';
/** A Buy now cart only needs to outlive one checkout. */
const BUY_NOW_TTL_SECONDS = 6 * 3600;

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
    private readonly plus: PlusBenefits,
  ) {}

  static newGuestId(): string {
    return randomBytes(32).toString('base64url');
  }

  private key(owner: CartOwner): string {
    if ('userId' in owner) return `cart:u:${owner.userId}`;
    if ('buyNowId' in owner) return `cart:b:${owner.buyNowId}`;
    return `cart:g:${owner.guestId}`;
  }

  /**
   * Starts a Buy now cart holding just this item, so checking out right away never sweeps up
   * (or empties) everything else in the shopper's cart. The id is a secret, like a guest cart's.
   */
  async buyNow(variantId: string, quantity: number): Promise<Cart> {
    return this.buyNowMany([{ variantId, quantity }]);
  }

  /** A Buy now cart with several lines (a Subscribe & Save delivery, p10-11). */
  async buyNowMany(lines: { variantId: string; quantity: number }[]): Promise<Cart> {
    for (const line of lines) await this.assertSellable(line.variantId);
    const owner = { buyNowId: CartService.newGuestId() };
    const key = this.key(owner);
    const fields: Record<string, number> = {};
    for (const line of lines) {
      fields[line.variantId] = Math.min(
        MAX_QUANTITY,
        (fields[line.variantId] ?? 0) + line.quantity,
      );
    }
    await this.run(() =>
      this.redis.client.multi().hset(key, fields).expire(key, BUY_NOW_TTL_SECONDS).exec(),
    );
    return this.view(owner);
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

  /** Active bundles every product of which is in these lines, with what they save. */
  async bundles(lines: CartLine[]): Promise<BundleSaving[]> {
    if (lines.length < 2) return [];
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const rows = await this.prisma.bundle.findMany({
      where: { status: 'ACTIVE', items: { some: { productId: { in: productIds } } } },
      include: { items: { select: { productId: true } } },
    });
    const present = new Set(productIds);
    return bundleSavings(
      lines,
      rows
        .filter((row) => row.items.every((item) => present.has(item.productId)))
        .map((row) => ({
          id: row.id,
          title: row.title,
          percentOff: row.percentOff,
          sellerId: row.sellerId,
          productIds: row.items.map((item) => item.productId),
        })),
    );
  }

  /**
   * The shopper's clipped, unused coupons on products in these lines, with what each saves:
   * a percentage off every unit of the product, or an amount off once (never more than the
   * product's total).
   */
  async clipped(userId: string, lines: CartLine[], now = new Date()): Promise<ClippedSaving[]> {
    if (!lines.length) return [];
    const productIds = [...new Set(lines.map((line) => line.productId))];
    const clips = await this.prisma.couponClip.findMany({
      where: {
        userId,
        usedAt: null,
        coupon: {
          status: 'ACTIVE',
          startsAt: { lte: now },
          endsAt: { gt: now },
          productId: { in: productIds },
        },
      },
      include: { coupon: true },
    });
    const savings: ClippedSaving[] = [];
    for (const clip of clips) {
      const c = clip.coupon;
      if (c.maxRedemptions !== null && c.redeemed >= c.maxRedemptions) continue;
      const own = lines.filter((line) => line.productId === c.productId);
      const total = own.reduce((sum, line) => sum + line.lineTotalCents, 0);
      const discount =
        c.kind === 'PERCENT'
          ? Math.round((total * (c.percentOff ?? 0)) / 100)
          : Math.min(c.amountOffCents ?? 0, total);
      if (discount <= 0) continue;
      savings.push({
        id: c.id,
        clipId: clip.id,
        productId: c.productId,
        productTitle: own[0]!.productTitle,
        discountCents: discount,
        sellerId: c.sellerId,
      });
    }
    return savings;
  }

  /** "Add bundle to cart": one of each product (their only option), added together. */
  async addBundle(owner: CartOwner, bundleId: string): Promise<Cart> {
    const bundle = await this.prisma.bundle.findFirst({
      where: { id: bundleId, status: 'ACTIVE' },
      include: {
        items: {
          include: {
            product: {
              select: {
                status: true,
                variants: { where: { isActive: true }, select: { id: true } },
              },
            },
          },
        },
      },
    });
    if (!bundle) throw new NotFoundException('That bundle is no longer offered.');
    const variants = bundle.items.map((item) =>
      item.product.status === 'ACTIVE' && item.product.variants.length === 1
        ? item.product.variants[0]!.id
        : null,
    );
    if (variants.some((id) => !id)) {
      throw new ConflictException('Part of this bundle isn’t available right now.');
    }
    for (const variantId of variants) await this.assertSellable(variantId!);
    const current = await this.quantities(owner);
    const added = variants.filter((id) => !current.has(id!)).length;
    if (current.size + added > MAX_LINES) {
      throw new BadRequestException(`A cart can hold up to ${MAX_LINES} different items.`);
    }
    for (const variantId of variants) {
      await this.write(
        owner,
        variantId!,
        Math.min(MAX_QUANTITY, (current.get(variantId!) ?? 0) + 1),
      );
    }
    return this.view(owner);
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
  async view(
    owner: CartOwner,
    region?: string | null,
    /** The signed-in customer looking at a buy-now cart (member prices, p10-15). */
    viewerId?: string | null,
  ): Promise<Cart> {
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
    // NIXZORA Plus (p10-15): member-only deal prices, free shipping, 2-day on NIXZORA's items.
    const memberId = 'userId' in owner ? owner.userId : (viewerId ?? null);
    const member = memberId ? await this.plus.isMember(memberId) : false;
    const memberPrices = member
      ? await this.plus.memberPrices(variants)
      : new Map<string, number>();

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
      const memberPrice = memberPrices.get(variantId);
      const unitPrice = memberPrice ?? variant.priceCents;
      lines.push({
        variantId,
        productId: variant.productId,
        productSlug: variant.product.slug,
        productTitle: variant.product.title,
        variantTitle: variant.title,
        sku: variant.sku,
        options: (variant.options ?? {}) as Record<string, string>,
        imageUrl: image ? this.storage.publicUrl(image.storageKey) : null,
        unitPriceCents: unitPrice,
        compareAtCents: memberPrice
          ? Math.max(variant.priceCents, variant.compareAtCents ?? 0)
          : variant.compareAtCents,
        quantity,
        lineTotalCents: unitPrice * quantity,
        ...(memberPrice ? { regularPriceCents: variant.priceCents } : {}),
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
    // Bundle & save (p10-16): complete sets of a bundle take its percentage off.
    const bundles = await this.bundles(lines.filter((line) => !line.problem));
    // Clipped coupons (p10-18): the shopper's, on products in the cart.
    const clipped = memberId
      ? await this.clipped(
          memberId,
          lines.filter((line) => !line.problem),
        )
      : [];

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
    const own = buyable.some((v) => !v.product.sellerId);
    return {
      delivery: !buyable.length
        ? null
        : member && buyable.every((v) => !v.product.sellerId)
          ? twoDayWindow(new Date())
          : deliveryWindow(new Date(), handling),
      cartId: 'guestId' in owner ? owner.guestId : 'buyNowId' in owner ? owner.buyNowId : null,
      // Gift wrap (p10-22) is done in NIXZORA's warehouse, so only for its own items.
      giftWrap: own ? { priceCents: GIFT_WRAP_CENTS } : null,
      lines,
      itemCount: lines.reduce((sum, line) => sum + line.quantity, 0),
      totals: this.pricing.totals(
        subtotal,
        region,
        check?.ok ? check.discountCents : 0,
        'USD',
        { member, twoDay: own },
        bundles.reduce((sum, b) => sum + b.discountCents, 0),
        clipped.reduce((sum, c) => sum + c.discountCents, 0),
      ),
      ...(clipped.length
        ? {
            clippedCoupons: clipped.map((c) => ({
              id: c.id,
              productId: c.productId,
              productTitle: c.productTitle,
              discountCents: c.discountCents,
            })),
          }
        : {}),
      ...(bundles.length
        ? {
            bundles: bundles.map(({ sellerId: _seller, ...bundle }) => bundle),
          }
        : {}),
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
