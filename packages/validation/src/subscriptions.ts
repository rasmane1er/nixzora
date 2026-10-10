import { z } from 'zod';
import { type CheckoutResponse } from './commerce';

/**
 * Subscribe & Save (p10-11): a product delivered every few weeks, charged to a saved card, at
 * 5% off, or 10% off for every item when 3 or more subscriptions arrive in the same delivery.
 * Stores choose which of their listings allow it and fund the discount; NIXZORA's own products
 * always qualify.
 */
export const SUBSCRIPTION_INTERVALS = [14, 30, 60, 90] as const;
export type SubscriptionInterval = (typeof SUBSCRIPTION_INTERVALS)[number];
export const SUBSCRIBE_PERCENT = 5;
export const SUBSCRIBE_BULK_PERCENT = 10;
/** Subscriptions in one delivery for the bigger discount. */
export const SUBSCRIBE_BULK_MIN = 3;
export const SUBSCRIPTION_MAX_QUANTITY = 10;
/** Charges that fail in a row before deliveries pause. */
export const SUBSCRIPTION_MAX_FAILURES = 3;

/** The discount a delivery gets: 10% with 3+ subscriptions in it, else 5%. */
export function subscribePercent(itemsInDelivery: number): number {
  return itemsInDelivery >= SUBSCRIBE_BULK_MIN ? SUBSCRIBE_BULK_PERCENT : SUBSCRIBE_PERCENT;
}

const interval = z.union(
  SUBSCRIPTION_INTERVALS.map((d) => z.literal(d)) as [
    z.ZodLiteral<14>,
    z.ZodLiteral<30>,
    z.ZodLiteral<60>,
    z.ZodLiteral<90>,
  ],
);

export const SubscriptionCreateSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(SUBSCRIPTION_MAX_QUANTITY).default(1),
  intervalDays: interval,
});
export type SubscriptionCreate = z.infer<typeof SubscriptionCreateSchema>;

export const SubscriptionUpdateSchema = z.object({
  quantity: z.number().int().min(1).max(SUBSCRIPTION_MAX_QUANTITY).optional(),
  intervalDays: interval.optional(),
  /** Pause or resume (cancelling is its own call). */
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
  /** Skip the next delivery: it moves on by one interval. */
  skipNext: z.boolean().optional(),
  /** Charge this saved card from now on. */
  paymentCardId: z.uuid().optional(),
});
export type SubscriptionUpdate = z.infer<typeof SubscriptionUpdateSchema>;

export type SubscriptionStatus = 'ACTIVE' | 'PAUSED' | 'CANCELLED';

export type SubscriptionView = {
  id: string;
  product: { id: string; slug: string; title: string; imageUrl: string | null };
  variantTitle: string;
  quantity: number;
  intervalDays: number;
  /** Next delivery is ordered on this day (null once cancelled). */
  nextOrderAt: string | null;
  status: SubscriptionStatus;
  /** Today's price per unit before the discount. */
  unitPriceCents: number;
  /** The card charged, e.g. "Visa ending in 4242" parts; null when it was removed. */
  card: { brand: string; last4: string } | null;
  shipTo: string;
  /** Failed charges in a row (shown with a note to update the card). */
  failures: number;
  lastOrderNumber: string | null;
};

export type SubscribeResult = { subscription: SubscriptionView; order: CheckoutResponse | null };
