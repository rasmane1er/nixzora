import {
  deliveryWindow,
  deliveryWindowFromShipment,
  releaseStart,
  twoDayWindow,
  type DeliveryWindow,
  type OrderView,
  OWN_HANDLING_DAYS,
  type TrackingStep,
} from '@nixzora/validation';
import { type PrismaClient } from '../../generated/prisma/client';
import { type OrderRow, preorderShipsOn } from '../orders/order-links';
import { type TrackingEvent } from './shipping-gateway';

type Db = Pick<PrismaClient, 'shipmentTracker' | 'shipmentEvent'>;

/**
 * Keeps what a carrier said about a tracking number (p10-04): its delivery estimate and every
 * scan. Trackers resend the whole history each time, so scans are stored once each.
 */
export async function recordTracking(prisma: Db, event: TrackingEvent): Promise<void> {
  if (event.carrier !== undefined || event.estimatedDeliveryAt !== undefined) {
    await prisma.shipmentTracker.upsert({
      where: { trackingNumber: event.trackingNumber },
      create: {
        trackingNumber: event.trackingNumber,
        carrier: event.carrier ?? null,
        estimatedDeliveryAt: event.estimatedDeliveryAt ?? null,
      },
      update: {
        ...(event.carrier ? { carrier: event.carrier } : {}),
        estimatedDeliveryAt: event.estimatedDeliveryAt ?? null,
      },
    });
  }
  if (event.details?.length) {
    await prisma.shipmentEvent.createMany({
      data: event.details.map((detail) => ({
        trackingNumber: event.trackingNumber,
        status: detail.status,
        description: detail.description,
        location: detail.location,
        occurredAt: detail.at,
      })),
      skipDuplicates: true,
    });
  }
}

function easternDay(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(at);
}

/** The later of two windows: an order has arrived when its slowest part has. */
function later(a: DeliveryWindow | null, b: DeliveryWindow | null): DeliveryWindow | null {
  if (!a) return b;
  if (!b) return a;
  return {
    earliest: a.earliest > b.earliest ? a.earliest : b.earliest,
    latest: a.latest > b.latest ? a.latest : b.latest,
  };
}

/**
 * Adds delivery estimates and carrier scans to a customer's order view (p10-04). A part not yet
 * shipped is estimated from when the order was paid and the store's handling time; a shipped one
 * from the carrier's estimate, or else from the ship date. Delivered or cancelled parts have none.
 */
export async function withTracking(
  prisma: Db,
  order: OrderRow,
  view: OrderView,
): Promise<OrderView> {
  const numbers = [order.trackingNumber, ...order.sellerOrders.map((p) => p.trackingNumber)].filter(
    (n): n is string => !!n,
  );
  const [trackers, events] = numbers.length
    ? await Promise.all([
        prisma.shipmentTracker.findMany({ where: { trackingNumber: { in: numbers } } }),
        prisma.shipmentEvent.findMany({
          where: { trackingNumber: { in: numbers } },
          orderBy: { occurredAt: 'desc' },
          take: 200,
        }),
      ])
    : [[], []];
  const steps = (number: string | null): TrackingStep[] =>
    number
      ? events
          .filter((e) => e.trackingNumber === number)
          .map((e) => ({
            status: e.status as TrackingStep['status'],
            description: e.description,
            location: e.location,
            at: e.occurredAt.toISOString(),
          }))
      : [];
  const estimate = (part: {
    trackingNumber: string | null;
    shippedAt: Date | null;
    deliveredAt: Date | null;
    cancelled: boolean;
    handlingDays: number;
    twoDay?: boolean;
    /** Pre-orders (p10-30): the part's last release day; it ships from then. */
    releaseDate?: string | null;
  }): DeliveryWindow | null => {
    if (part.deliveredAt || part.cancelled || !order.placedAt) return null;
    const carrier = trackers.find((t) => t.trackingNumber === part.trackingNumber);
    if (carrier?.estimatedDeliveryAt) {
      const day = easternDay(carrier.estimatedDeliveryAt);
      return { earliest: day, latest: day };
    }
    if (part.shippedAt) {
      // NIXZORA Plus 2-day (p10-15): two business days from shipping.
      return part.twoDay
        ? twoDayWindow(part.shippedAt)
        : deliveryWindowFromShipment(part.shippedAt);
    }
    // Not shipped yet: from the order, or from the release day of a pre-order.
    const from =
      part.releaseDate && releaseStart(part.releaseDate) > order.placedAt
        ? releaseStart(part.releaseDate)
        : order.placedAt;
    return part.twoDay ? twoDayWindow(from) : deliveryWindow(from, part.handlingDays);
  };

  const ownItems = order.items.some((item) => !item.sellerId);
  const own = ownItems
    ? estimate({
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
        deliveredAt: order.deliveredAt,
        cancelled: !!order.cancelledAt,
        handlingDays: OWN_HANDLING_DAYS,
        twoDay: order.shippingSpeed === 'TWO_DAY',
        releaseDate: preorderShipsOn({ items: order.items.filter((item) => !item.sellerId) }),
      })
    : null;
  let overall = own;
  const shipments = view.shipments.map((shipment) => {
    // Shipments list NIXZORA's own part first (when there is one), then each store in order.
    const part = shipment.seller
      ? order.sellerOrders.find((p) => p.seller.handle === shipment.seller!.handle)
      : null;
    if (!part) return { ...shipment, estimatedDelivery: own, events: steps(order.trackingNumber) };
    const window = estimate({
      trackingNumber: part.trackingNumber,
      shippedAt: part.shippedAt,
      deliveredAt: part.deliveredAt,
      cancelled: part.status === 'CANCELLED',
      handlingDays: part.seller.handlingDays,
      releaseDate: preorderShipsOn({
        items: order.items.filter((item) => item.sellerId === part.sellerId),
      }),
    });
    overall = later(overall, window);
    return { ...shipment, estimatedDelivery: window, events: steps(part.trackingNumber) };
  });
  return {
    ...view,
    shipments,
    estimatedDelivery: ['DELIVERED', 'CANCELLED', 'REFUNDED', 'PENDING_PAYMENT'].includes(
      order.status,
    )
      ? null
      : overall,
    trackingEvents: steps(order.trackingNumber),
  };
}
