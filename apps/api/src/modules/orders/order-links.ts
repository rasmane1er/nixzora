import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import {
  CUSTOMER_CANCEL_MINUTES,
  type OrderStatus,
  type OrderView,
  RETURN_WINDOW_DAYS,
  SELLER_RATING_WINDOW_DAYS,
} from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';

/** Guest order links carry HMAC(secret, order id): nothing to store, and it can't be guessed. */
export function orderAccessToken(secret: string, orderId: string): string {
  return createHmac('sha256', secret).update(`order:${orderId}`).digest('base64url');
}

export function verifyOrderAccessToken(secret: string, orderId: string, token: string): boolean {
  const expected = Buffer.from(orderAccessToken(secret, orderId));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

const NUMBER_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** "NX-7KQ4M2": short, readable aloud, no 0/O or 1/I confusion. */
export function newOrderNumber(): string {
  let out = 'NX-';
  for (let i = 0; i < 6; i += 1) out += NUMBER_ALPHABET[randomInt(NUMBER_ALPHABET.length)];
  return out;
}

export const TRACKING_URLS: Record<string, (n: string) => string> = {
  UPS: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  FedEx: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  DHL: (n) => `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
};

const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 86_400_000;

/** Customers can rate a seller shipment from delivery until the window closes. */
export function ratableUntil(part: { status: string; deliveredAt: Date | null }): Date | null {
  if (part.status !== 'DELIVERED' || !part.deliveredAt) return null;
  const until = new Date(part.deliveredAt.getTime() + SELLER_RATING_WINDOW_DAYS * 86_400_000);
  return until > new Date() ? until : null;
}

export function returnableUntil(order: {
  status: string;
  deliveredAt: Date | null;
  kind?: string;
}): string | null {
  // Gift cards (p10-10) aren't returned: an unredeemed one can be refunded by support. Nor is
  // a Plus fee (p10-15): leaving ends renewals, and support can refund it.
  if (order.kind === 'GIFT_CARD' || order.kind === 'PLUS') return null;
  if (!order.deliveredAt || !['DELIVERED', 'PARTIALLY_REFUNDED'].includes(order.status))
    return null;
  const until = new Date(order.deliveredAt.getTime() + RETURN_WINDOW_MS);
  return until > new Date() ? until.toISOString() : null;
}

/**
 * Customers can cancel their own order for a short while after placing it (p10-09), as long as
 * nobody has started on it: paid, nothing packed or shipped.
 */
export function cancellableUntil(order: {
  status: string;
  placedAt: Date | null;
  trackingNumber: string | null;
  sellerOrders?: { status: string }[];
}): string | null {
  if (order.status !== 'PAID' || !order.placedAt || order.trackingNumber) return null;
  if ((order.sellerOrders ?? []).some((part) => part.status !== 'PAID')) return null;
  const until = new Date(order.placedAt.getTime() + CUSTOMER_CANCEL_MINUTES * 60_000);
  return until > new Date() ? until.toISOString() : null;
}

export const orderInclude = {
  items: true,
  sellerOrders: {
    include: {
      seller: { select: { handle: true, displayName: true, handlingDays: true } },
      rating: { select: { rating: true, comment: true } },
    },
  },
  giftCards: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude;
export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

function tracking(carrier: string | null, number: string | null) {
  return carrier && number
    ? { carrier, number, url: TRACKING_URLS[carrier]?.(number) ?? null }
    : null;
}

/** One entry for NIXZORA's own items and one per seller, for marketplace orders only. */
function shipments(order: OrderRow): OrderView['shipments'] {
  if (!order.items.some((item) => item.sellerId)) return [];
  const own = order.items.filter((item) => !item.sellerId);
  const out: OrderView['shipments'] = [];
  if (own.length) {
    out.push({
      seller: null,
      status: order.cancelledAt
        ? 'CANCELLED'
        : order.deliveredAt
          ? 'DELIVERED'
          : order.trackingNumber
            ? 'SHIPPED'
            : 'PROCESSING',
      tracking: tracking(order.trackingCarrier, order.trackingNumber),
      itemIds: own.map((item) => item.id),
      rating: null,
      ratableUntil: null,
    });
  }
  for (const part of order.sellerOrders) {
    out.push({
      seller: { handle: part.seller.handle, displayName: part.seller.displayName },
      status: part.status === 'PAID' ? 'PROCESSING' : part.status,
      tracking: tracking(part.trackingCarrier, part.trackingNumber),
      itemIds: order.items.filter((item) => item.sellerId === part.sellerId).map((item) => item.id),
      rating: part.rating ? { value: part.rating.rating, comment: part.rating.comment } : null,
      ratableUntil: ratableUntil(part)?.toISOString() ?? null,
    });
  }
  return out;
}

export function toOrderView(order: OrderRow): OrderView {
  const timeline: { status: OrderStatus; at: string }[] = [];
  const add = (status: OrderStatus, at: Date | null) => {
    if (at) timeline.push({ status, at: at.toISOString() });
  };
  add('PENDING_PAYMENT', order.createdAt);
  add('PAID', order.placedAt);
  add('FULFILLING', order.fulfillingAt);
  add('SHIPPED', order.shippedAt);
  add('DELIVERED', order.deliveredAt);
  add('CANCELLED', order.cancelledAt);

  return {
    id: order.id,
    number: order.number,
    email: order.email,
    status: order.status,
    currency: order.currency,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    couponCode: order.couponCode,
    shippingCents: order.shippingCents,
    taxCents: order.taxCents,
    totalCents: order.totalCents,
    refundedCents: order.refundedCents,
    shippingAddress: order.shippingAddress as OrderView['shippingAddress'],
    items: order.items.map((item) => ({
      id: item.id,
      variantId: item.variantId,
      productTitle: item.productTitle,
      variantTitle: item.variantTitle,
      sku: item.sku,
      unitPriceCents: item.unitPriceCents,
      quantity: item.quantity,
      totalCents: item.totalCents,
    })),
    tracking:
      order.trackingCarrier && order.trackingNumber
        ? {
            carrier: order.trackingCarrier,
            number: order.trackingNumber,
            url: TRACKING_URLS[order.trackingCarrier]?.(order.trackingNumber) ?? null,
          }
        : null,
    shipments: shipments(order),
    returnableUntil: returnableUntil(order),
    cancellableUntil: cancellableUntil(order),
    kind: order.kind ?? 'GOODS',
    shippingSpeed: order.shippingSpeed ?? 'STANDARD',
    plusSavingsCents: order.plusSavingsCents ?? 0,
    bundleDiscountCents: order.bundleDiscountCents ?? 0,
    multiBuyDiscountCents: order.multiBuyDiscountCents ?? 0,
    clipDiscountCents: order.clipDiscountCents ?? 0,
    gift: order.isGift
      ? {
          message: order.giftMessage ?? null,
          from: order.giftFrom ?? null,
          wrapCents: order.giftWrapCents ?? 0,
        }
      : null,
    giftBalanceCents: order.giftBalanceCents ?? 0,
    // Optional so rows loaded without the gift cards (older fixtures) still map.
    giftCards: (order.giftCards ?? []).map((card) => ({
      id: card.id,
      amountCents: card.amountCents,
      recipientName: card.recipientName,
      recipientEmail: card.recipientEmail,
      status: card.status,
      last4: card.last4,
      sentAt: card.sentAt?.toISOString() ?? null,
    })),
    timeline,
    createdAt: order.createdAt.toISOString(),
    placedAt: order.placedAt?.toISOString() ?? null,
  };
}
