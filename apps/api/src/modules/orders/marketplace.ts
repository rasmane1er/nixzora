import { ConflictException } from '@nestjs/common';
import { type Prisma } from '../../generated/prisma/client';

/**
 * Marketplace orders (p7-04, p7-05, ADR-0013). Plain functions over a transaction, so checkout,
 * fulfillment, labels and refunds apply the same rules inside their own transactions.
 *
 * - When an order is paid, each seller's lines become a SellerOrder with its commission.
 * - A seller ships its part; the order is SHIPPED once every part has shipped.
 * - Shipping a part credits the seller's ledger, available after the store's hold period.
 * - Refunds are attributed to the sellers whose items were refunded and debited from them.
 */

type Tx = Prisma.TransactionClient;

export const commissionOf = (cents: number, bps: number) => Math.round((cents * bps) / 10_000);

type SplitOrder = {
  id: string;
  number: string;
  subtotalCents: number;
  shippingCents: number;
  /** Shipping a Plus member did not pay (p10-15): NIXZORA pays sellers their share of it. */
  shippingWaivedCents?: number;
  /** Bundle & save (p10-16): each store's bundle discount, which it funds. */
  bundleDiscounts?: unknown;
  /** Clipped coupons (p10-18): each store's coupon discount, which it funds. */
  clipDiscounts?: unknown;
  items: { sellerId: string | null; totalCents: number }[];
};

/** Creates one SellerOrder per seller in a paid order. Safe to run twice. */
export async function splitBySeller(tx: Tx, order: SplitOrder): Promise<number> {
  const bySeller = new Map<string, number>();
  for (const item of order.items) {
    if (item.sellerId)
      bySeller.set(item.sellerId, (bySeller.get(item.sellerId) ?? 0) + item.totalCents);
  }
  if (!bySeller.size) return 0;
  const sellers = await tx.seller.findMany({
    where: { id: { in: [...bySeller.keys()] } },
    select: { id: true, commissionBps: true },
  });
  let created = 0;
  for (const seller of sellers) {
    const itemsCents = bySeller.get(seller.id)!;
    const shipping = order.shippingCents + (order.shippingWaivedCents ?? 0);
    const shippingCents = order.subtotalCents
      ? Math.round((shipping * itemsCents) / order.subtotalCents)
      : 0;
    // A store's own bundles come off its items; commission is on what it actually sold for.
    const funded = (map: unknown) =>
      Math.max(0, Number((map as Record<string, number> | null)?.[seller.id] ?? 0));
    // A store's bundles and clipped coupons come off its items (p10-16, p10-18).
    const bundled = Math.min(
      itemsCents,
      funded(order.bundleDiscounts) + funded(order.clipDiscounts),
    );
    const soldCents = itemsCents - bundled;
    const commissionCents = commissionOf(soldCents, seller.commissionBps);
    const existing = await tx.sellerOrder.findUnique({
      where: { orderId_sellerId: { orderId: order.id, sellerId: seller.id } },
      select: { id: true, status: true },
    });
    if (existing) {
      // A late payment for a cancelled order brings the seller's part back.
      if (existing.status === 'CANCELLED') {
        await tx.sellerOrder.update({
          where: { id: existing.id },
          data: { status: 'PAID', cancelledAt: null },
        });
      }
      continue;
    }
    const row = await tx.sellerOrder.create({
      data: {
        orderId: order.id,
        sellerId: seller.id,
        itemsCents: soldCents,
        shippingCents,
        commissionBps: seller.commissionBps,
        commissionCents,
        netCents: soldCents + shippingCents - commissionCents,
      },
    });
    await tx.outboxEvent.create({
      data: {
        aggregateType: 'seller_order',
        aggregateId: row.id,
        type: 'seller.order.created',
        payload: { sellerId: seller.id, orderId: order.id, number: order.number },
      },
    });
    created++;
  }
  return created;
}

/** True when the order has lines sold by marketplace sellers. */
export function hasSellerItems(order: { items: { sellerId: string | null }[] }): boolean {
  return order.items.some((item) => item.sellerId);
}

/**
 * Records a shipment for NIXZORA's own items (`firstParty`) and/or re-checks the order after a
 * seller shipped. The order becomes SHIPPED, with one "order.shipped" event, only when every
 * part has shipped; until then it is FULFILLING. Returns true if the order is now shipped.
 */
export async function settleShipment(
  tx: Tx,
  orderId: string,
  firstParty?: {
    carrier: string;
    trackingNumber: string;
    labelUrl?: string | null;
    postageCents?: number | null;
  },
): Promise<boolean> {
  const now = new Date();
  const order = await tx.order.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { select: { sellerId: true } }, sellerOrders: { select: { status: true } } },
  });
  if (!['PAID', 'FULFILLING'].includes(order.status)) {
    // A seller may still ship its part of, say, a partially refunded order; the order's own
    // status is then left as staff set it.
    if (!firstParty) return false;
    throw new ConflictException(
      `A ${order.status.toLowerCase().replace('_', ' ')} order can't ship.`,
    );
  }
  const ownItems = order.items.some((item) => !item.sellerId);
  let ownShipped = !ownItems || Boolean(order.trackingNumber);
  if (firstParty) {
    if (!ownItems) {
      throw new ConflictException('Every item in this order ships from its seller.');
    }
    if (order.trackingNumber) {
      throw new ConflictException("NIXZORA's items in this order have already shipped.");
    }
    await tx.order.update({
      where: { id: orderId },
      data: {
        trackingCarrier: firstParty.carrier,
        trackingNumber: firstParty.trackingNumber.toUpperCase(),
        ...(firstParty.labelUrl !== undefined ? { labelUrl: firstParty.labelUrl } : {}),
        ...(firstParty.postageCents !== undefined ? { postageCents: firstParty.postageCents } : {}),
      },
    });
    ownShipped = true;
  }
  const sellersDone = order.sellerOrders.every((part) => part.status !== 'PAID');
  if (ownShipped && sellersDone) {
    const shipped = await tx.order.updateMany({
      where: { id: orderId, status: { in: ['PAID', 'FULFILLING'] } },
      data: { status: 'SHIPPED', shippedAt: now, fulfillingAt: order.fulfillingAt ?? now },
    });
    if (shipped.count) {
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'order',
          aggregateId: orderId,
          type: 'order.shipped',
          payload: { number: order.number },
        },
      });
    }
    return true;
  }
  await tx.order.updateMany({
    where: { id: orderId, status: 'PAID' },
    data: { status: 'FULFILLING', fulfillingAt: now },
  });
  return false;
}

/** The whole order was delivered: so were the sellers' parts. */
export function markPartsDelivered(tx: Tx, orderId: string, at = new Date()) {
  return tx.sellerOrder.updateMany({
    where: { orderId, status: 'SHIPPED' },
    data: { status: 'DELIVERED', deliveredAt: at },
  });
}

/** Refuses to cancel an order once a seller has shipped part of it. */
export async function assertNoSellerShipped(tx: Tx, orderId: string) {
  const shipped = await tx.sellerOrder.count({
    where: { orderId, status: { in: ['SHIPPED', 'DELIVERED'] } },
  });
  if (shipped) {
    throw new ConflictException('Part of this order has already shipped. Refund it instead.');
  }
}

type RefundedOrder = {
  id: string;
  number: string;
  items: {
    variantId: string | null;
    sellerId?: string | null;
    totalCents?: number;
    unitPriceCents?: number;
  }[];
};

/**
 * Attributes a customer refund to the sellers whose items it covers and debits their ledger.
 * With restocked lines, the refund follows those lines; otherwise it is shared by each party's
 * share of the items. The commission on the refunded amount goes back to the seller.
 */
export async function allocateRefund(
  tx: Tx,
  order: RefundedOrder,
  refund: { id: string; amountCents: number; cancel: boolean },
  restock: { variantId: string; quantity: number }[] = [],
): Promise<void> {
  const parts = await tx.sellerOrder.findMany({ where: { orderId: order.id } });
  if (!parts.length) return;
  const now = new Date();

  if (refund.cancel) {
    for (const part of parts.filter((p) => p.status === 'PAID')) {
      await tx.sellerOrder.update({
        where: { id: part.id },
        data: {
          status: 'CANCELLED',
          cancelledAt: now,
          refundedCents: part.itemsCents + part.shippingCents,
        },
      });
      // Earlier partial refunds on a part that never shipped are reversed: it earned nothing.
      const debits = await tx.sellerLedgerEntry.aggregate({
        where: { sellerOrderId: part.id, type: 'REFUND' },
        _sum: { amountCents: true },
      });
      const owed = -(debits._sum.amountCents ?? 0);
      if (owed) {
        await tx.sellerLedgerEntry.create({
          data: {
            sellerId: part.sellerId,
            sellerOrderId: part.id,
            type: 'ADJUSTMENT',
            amountCents: owed,
            availableAt: now,
            description: `Order ${order.number} cancelled before shipping: earlier refund reversed`,
            idempotencyKey: `cancel:${part.id}`,
          },
        });
      }
    }
    return;
  }

  // Value of the items this refund covers, per seller ("" = NIXZORA).
  const weight = new Map<string, number>();
  const add = (key: string, cents: number) => weight.set(key, (weight.get(key) ?? 0) + cents);
  if (restock.length) {
    for (const line of restock) {
      const item = order.items.find((i) => i.variantId === line.variantId);
      if (item) add(item.sellerId ?? '', (item.unitPriceCents ?? 0) * line.quantity);
    }
  }
  if (![...weight.values()].some((v) => v > 0)) {
    weight.clear();
    for (const item of order.items) add(item.sellerId ?? '', item.totalCents ?? 0);
  }
  const total = [...weight.values()].reduce((sum, v) => sum + v, 0);
  if (!total) return;

  for (const part of parts) {
    if (part.status === 'CANCELLED') continue;
    const share = Math.min(
      Math.round((refund.amountCents * (weight.get(part.sellerId) ?? 0)) / total),
      part.itemsCents + part.shippingCents - part.refundedCents,
    );
    if (share <= 0) continue;
    const debit = share - commissionOf(share, part.commissionBps);
    await tx.sellerOrder.update({
      where: { id: part.id },
      data: { refundedCents: { increment: share } },
    });
    await tx.sellerLedgerEntry.create({
      data: {
        sellerId: part.sellerId,
        sellerOrderId: part.id,
        type: 'REFUND',
        amountCents: -debit,
        availableAt: now,
        description: `Refund on order ${order.number}`,
        idempotencyKey: `refund:${refund.id}:${part.id}`,
      },
    });
  }
}

/**
 * Earnings for a shipment the carrier has not scanned yet (p9-05): the ledger entry exists but
 * is never "available", so no payout includes it, until the first scan sets the real date.
 */
export const AWAITING_CARRIER_SCAN = new Date('9999-01-01T00:00:00.000Z');

/** Days a seller's tracking number may go unscanned before the store's payouts are reviewed. */
export const UNSCANNED_SHIPMENT_DAYS = 7;

const DAY_MS = 86_400_000;

/**
 * The carrier scanned a seller's shipment (in transit or delivered): its earnings start their
 * normal hold from the day it shipped, and a delivered part is marked delivered. Returns how
 * many seller shipments changed.
 */
export async function verifySellerShipment(
  tx: Tx,
  trackingNumber: string,
  delivered: boolean,
  at = new Date(),
): Promise<number> {
  const parts = await tx.sellerOrder.findMany({
    where: {
      trackingNumber: trackingNumber.toUpperCase(),
      status: { in: ['SHIPPED', 'DELIVERED'] },
    },
    include: { seller: { select: { payoutHoldDays: true } } },
  });
  let changed = 0;
  for (const part of parts) {
    let touched = false;
    if (!part.trackingVerifiedAt) {
      await tx.sellerOrder.update({ where: { id: part.id }, data: { trackingVerifiedAt: at } });
      const shippedAt = part.shippedAt ?? at;
      await tx.sellerLedgerEntry.updateMany({
        where: { idempotencyKey: `sale:${part.id}`, availableAt: AWAITING_CARRIER_SCAN },
        data: { availableAt: new Date(shippedAt.getTime() + part.seller.payoutHoldDays * DAY_MS) },
      });
      touched = true;
    }
    if (delivered && part.status === 'SHIPPED') {
      await tx.sellerOrder.update({
        where: { id: part.id },
        data: { status: 'DELIVERED', deliveredAt: at },
      });
      touched = true;
    }
    if (touched) changed++;
  }
  return changed;
}
