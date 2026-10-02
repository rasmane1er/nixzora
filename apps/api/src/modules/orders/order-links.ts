import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { type OrderStatus, type OrderView, RETURN_WINDOW_DAYS } from '@nixzora/validation';
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

const TRACKING_URLS: Record<string, (n: string) => string> = {
  UPS: (n) => `https://www.ups.com/track?tracknum=${encodeURIComponent(n)}`,
  USPS: (n) => `https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(n)}`,
  FedEx: (n) => `https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(n)}`,
  DHL: (n) => `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${encodeURIComponent(n)}`,
};

const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 86_400_000;

function returnableUntil(order: { status: string; deliveredAt: Date | null }): string | null {
  if (!order.deliveredAt || !['DELIVERED', 'PARTIALLY_REFUNDED'].includes(order.status))
    return null;
  const until = new Date(order.deliveredAt.getTime() + RETURN_WINDOW_MS);
  return until > new Date() ? until.toISOString() : null;
}

export const orderInclude = { items: true } satisfies Prisma.OrderInclude;
export type OrderRow = Prisma.OrderGetPayload<{ include: typeof orderInclude }>;

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
    returnableUntil: returnableUntil(order),
    timeline,
    createdAt: order.createdAt.toISOString(),
    placedAt: order.placedAt?.toISOString() ?? null,
  };
}
