import { z } from 'zod';

/**
 * Spend more, save more (p10-31): "Spend $50, save $5 · Spend $100, save $15" on everything a
 * store sells. The cart adds up what the shopper spends with the store (after bundles and Buy X,
 * get Y) and takes off the highest tier reached. A store funds its own, NIXZORA its own range.
 */
export const SPEND_MAX_TIERS = 3;
/** $10 to $2,000. */
export const SPEND_MIN_CENTS = 1_000;
export const SPEND_MAX_CENTS = 200_000;
/** At least $1 off, and never more than half of the tier's spend. */
export const SPEND_MIN_OFF_CENTS = 100;
export const SPEND_MAX_DAYS = 90;

export const SpendTierSchema = z.object({
  minCents: z.number().int().min(SPEND_MIN_CENTS).max(SPEND_MAX_CENTS),
  offCents: z.number().int().min(SPEND_MIN_OFF_CENTS),
});
export type SpendTier = z.infer<typeof SpendTierSchema>;

export const SpendOfferCreateSchema = z.object({
  tiers: z
    .array(SpendTierSchema)
    .min(1)
    .max(SPEND_MAX_TIERS)
    .superRefine((tiers, ctx) => {
      tiers.forEach((tier, i) => {
        if (tier.offCents * 2 > tier.minCents) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'offCents'],
            message: 'The saving can be at most half of what shoppers spend.',
          });
        }
        const prev = tiers[i - 1];
        if (prev && (tier.minCents <= prev.minCents || tier.offCents <= prev.offCents)) {
          ctx.addIssue({
            code: 'custom',
            path: [i, 'minCents'],
            message: 'Each tier needs a higher spend and a bigger saving than the one before.',
          });
        }
      });
    }),
  /** How many days it runs from now; none = until it's ended. */
  days: z.number().int().min(1).max(SPEND_MAX_DAYS).nullable().optional(),
});
export type SpendOfferCreate = z.infer<typeof SpendOfferCreateSchema>;

/** Dollars as typed in a form ("50", "49.99") → cents, or NaN. */
export function dollarsToCents(value: unknown): number {
  const text = String(value ?? '').trim();
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(text)) return Number.NaN;
  return Math.round(Number(text) * 100);
}

/** In English for audit and API messages: "Spend $50, save $5; spend $100, save $15". */
export function spendText(tiers: readonly SpendTier[]): string {
  const usd = (c: number) => `$${(c / 100).toFixed(c % 100 ? 2 : 0)}`;
  return tiers
    .map((t, i) => `${i ? 'spend' : 'Spend'} ${usd(t.minCents)}, save ${usd(t.offCents)}`)
    .join('; ');
}

export type SpendOfferStatus = 'ACTIVE' | 'ENDED';

export type SpendOfferView = {
  id: string;
  tiers: SpendTier[];
  status: SpendOfferStatus;
  endsAt: string | null;
  /** The store; null is NIXZORA's own range. */
  seller: { handle: string; displayName: string } | null;
  /** Paid orders that used it. */
  orders: number;
  createdAt: string;
};

/** On a product page: the live offer of the store that sells it. */
export const SpendOfferBriefSchema = z.object({
  id: z.uuid(),
  tiers: z.array(SpendTierSchema),
  endsAt: z.string().nullable(),
});
export type SpendOfferBrief = z.infer<typeof SpendOfferBriefSchema>;

/** A store's offer in the cart: what it saved and how far the next tier is. */
export type CartSpendOffer = {
  id: string;
  seller: { handle: string; displayName: string } | null;
  tiers: SpendTier[];
  /** What counts towards it: the store's items after bundles and Buy X, get Y. */
  spentCents: number;
  discountCents: number;
  /** The next tier up, and how much more to spend to reach it; null at the top tier. */
  next: { minCents: number; offCents: number; moreCents: number } | null;
};

export type SpendRule = { id: string; sellerId: string | null; tiers: SpendTier[] };

export type SpendSaving = Omit<CartSpendOffer, 'seller'> & { sellerId: string | null };

/** The tier reached at this spend (the highest whose minimum it meets), or null. */
export function spendTierFor(tiers: readonly SpendTier[], spentCents: number): SpendTier | null {
  let reached: SpendTier | null = null;
  for (const tier of tiers) if (spentCents >= tier.minCents) reached = tier;
  return reached;
}

/**
 * What each store's offer saves, from what the shopper spends with each store (keyed by seller
 * id, '' for NIXZORA). The saving never exceeds the spend. Offers with nothing in the cart are
 * left out; ones below their first tier are kept, for the "spend $X more" nudge.
 */
export function spendSavings(
  spentBySeller: ReadonlyMap<string, number>,
  offers: readonly SpendRule[],
): SpendSaving[] {
  const out: SpendSaving[] = [];
  for (const offer of offers) {
    const spentCents = Math.max(0, spentBySeller.get(offer.sellerId ?? '') ?? 0);
    if (!spentCents) continue;
    const tiers = [...offer.tiers].sort((a, b) => a.minCents - b.minCents);
    const reached = spendTierFor(tiers, spentCents);
    const next = tiers.find((t) => t.minCents > spentCents);
    out.push({
      id: offer.id,
      sellerId: offer.sellerId,
      tiers,
      spentCents,
      discountCents: Math.min(spentCents, reached?.offCents ?? 0),
      next: next ? { ...next, moreCents: next.minCents - spentCents } : null,
    });
  }
  return out;
}
