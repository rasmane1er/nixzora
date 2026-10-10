import { z } from 'zod';
import { type CheckoutResponse } from './commerce';

/**
 * NIXZORA Plus (p10-15): a membership at $7.99 a month or $79 a year, free for the first 30 days
 * (once per customer). Members get free 2-day delivery on items NIXZORA ships, free standard
 * shipping on everything else, member-only deal prices, and lightning deals 30 minutes early.
 * Renewals are charged to a saved card; members can leave at any time and keep the benefits
 * until the period they paid for ends.
 */
export const PLUS_PLANS = ['MONTHLY', 'YEARLY'] as const;
export type PlusPlan = (typeof PLUS_PLANS)[number];
export const PLUS_PRICE_CENTS: Record<PlusPlan, number> = { MONTHLY: 799, YEARLY: 7_900 };
export const PLUS_TRIAL_DAYS = 30;
/** After a renewal fails, benefits continue this long while the charge is retried. */
export const PLUS_GRACE_DAYS = 3;
/** The trial-ending email goes out this many days before the first charge. */
export const PLUS_REMIND_DAYS = 3;

export type PlusStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'ENDED';

/** What the Plus page shows anyone: prices and the trial. */
export type PlusOffer = {
  plans: { plan: PlusPlan; priceCents: number; months: number }[];
  currency: string;
  trialDays: number;
  /** Signed-in: whether this customer can still start a free trial. */
  trialAvailable: boolean | null;
};

export type PlusMembershipView = {
  plan: PlusPlan;
  status: PlusStatus;
  /** Members have the benefits now (trial, paid, or within the grace period). */
  active: boolean;
  /** Benefits run until here; the next charge is due then unless leaving. */
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  trial: boolean;
  /** The next charge, when one is coming. */
  nextCharge: { amountCents: number; at: string } | null;
  /** The card renewals go to (the default card when none was chosen). */
  card: { id: string; brand: string; last4: string } | null;
  /** A renewal that could not be charged: pay it at /checkout/pay/<number>. */
  unpaidOrderNumber: string | null;
  /** Free shipping and member prices on orders placed as a member. */
  savedCents: number;
  memberSince: string;
};

export type MyPlus = { offer: PlusOffer; membership: PlusMembershipView | null };

export const PlusJoinSchema = z.object({
  plan: z.enum(PLUS_PLANS),
  /** A saved card for renewals (or, with no trial left, for the first charge now). */
  paymentCardId: z.uuid().nullable().optional(),
});
export type PlusJoin = z.infer<typeof PlusJoinSchema>;

/** Joining: the membership, and for a paid start the payment to finish like any checkout. */
export type PlusJoinResult = {
  membership: PlusMembershipView | null;
  checkout: CheckoutResponse | null;
};

export const PlusUpdateSchema = z
  .object({
    /** From the next renewal on. */
    plan: z.enum(PLUS_PLANS).optional(),
    /** true: leave at the end of the period; false: stay. */
    cancelAtPeriodEnd: z.boolean().optional(),
    paymentCardId: z.uuid().nullable().optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Nothing to change.' });
export type PlusUpdate = z.infer<typeof PlusUpdateSchema>;

/** Ops: members and the numbers that matter. */
export type AdminPlusMember = {
  userId: string;
  email: string;
  name: string;
  plan: PlusPlan;
  status: PlusStatus;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  failedAttempts: number;
  startedAt: string;
};

export type AdminPlusOverview = {
  counts: Record<PlusStatus, number>;
  /** Monthly recurring revenue from paying members (yearly plans divided by 12), in cents. */
  mrrCents: number;
  leaving: number;
  members: AdminPlusMember[];
};

export const AdminPlusQuerySchema = z.object({
  status: z.enum(['TRIALING', 'ACTIVE', 'PAST_DUE', 'ENDED']).optional(),
  q: z.string().trim().max(200).optional(),
});
export type AdminPlusQuery = z.infer<typeof AdminPlusQuerySchema>;
