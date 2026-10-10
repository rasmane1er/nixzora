import { z } from 'zod';
import type { ProductCard } from './catalog';

/**
 * Buy X, get Y (p10-27): "Buy 2, get 1 free" across a set of products. Shoppers mix and match
 * any of the offer's products; for every full group of buy + get units, the cheapest `get` units
 * of the group are free or a percentage off. A store funds its own offers, NIXZORA its own.
 */
export const MULTI_BUY_MAX_BUY = 9;
export const MULTI_BUY_MAX_GET = 5;
export const MULTI_BUY_MIN_PERCENT = 10;
export const MULTI_BUY_MAX_PRODUCTS = 50;
export const MULTI_BUY_MAX_DAYS = 90;

export const MultiBuyCreateSchema = z
  .object({
    buyQty: z.number().int().min(1).max(MULTI_BUY_MAX_BUY),
    getQty: z.number().int().min(1).max(MULTI_BUY_MAX_GET),
    /** 100 is free. */
    percentOff: z.number().int().min(MULTI_BUY_MIN_PERCENT).max(100),
    productIds: z
      .array(z.uuid())
      .min(1)
      .max(MULTI_BUY_MAX_PRODUCTS)
      .refine((ids) => new Set(ids).size === ids.length, 'Each product once.'),
    /** How many days it runs from now; none = until it's ended. */
    days: z.number().int().min(1).max(MULTI_BUY_MAX_DAYS).nullable().optional(),
  })
  .refine((v) => v.getQty <= v.buyQty, {
    path: ['getQty'],
    message: 'Shoppers can’t get more than they buy.',
  });
export type MultiBuyCreate = z.infer<typeof MultiBuyCreateSchema>;

export type MultiBuyTerms = { buyQty: number; getQty: number; percentOff: number };

/** The terms in English (API messages, audit): "Buy 2, get 1 free", "Buy 3, get 1 50% off". */
export function multiBuyText({ buyQty, getQty, percentOff }: MultiBuyTerms): string {
  return `Buy ${buyQty}, get ${getQty} ${percentOff >= 100 ? 'free' : `${percentOff}% off`}`;
}

export type MultiBuyStatus = 'ACTIVE' | 'ENDED';

export type MultiBuyView = MultiBuyTerms & {
  id: string;
  status: MultiBuyStatus;
  /** When it stops; null runs until ended. */
  endsAt: string | null;
  products: ProductCard[];
  seller: { handle: string; displayName: string } | null;
  /** Times it was used in paid orders. */
  orders: number;
  createdAt: string;
};

/** On a product card and page: the live offer the product is in. */
export const CardMultiBuySchema = z.object({
  id: z.uuid(),
  buyQty: z.number().int(),
  getQty: z.number().int(),
  percentOff: z.number().int(),
  endsAt: z.string().nullable(),
});
export type CardMultiBuy = z.infer<typeof CardMultiBuySchema>;

/** An offer in the cart: what it saved, and how many more units would get the next reward. */
export type CartMultiBuy = MultiBuyTerms & {
  id: string;
  /** Full groups in the cart. */
  times: number;
  discountCents: number;
  /** Add this many more of the offer's products and they're the discounted ones; 0 = none. */
  addMore: number;
};

export type MultiBuyRule = MultiBuyTerms & {
  id: string;
  sellerId: string | null;
  productIds: string[];
};

export type MultiBuySaving = CartMultiBuy & { sellerId: string | null };

/**
 * What offers save on the units left after bundles (unit prices per product). Units are taken
 * most expensive first in groups of buy + get, and the cheapest `get` of each full group are
 * discounted, so the shopper always gets the cheaper items free (the usual rule in stores). A
 * product is in one live offer at most, so offers never share a unit.
 */
export function multiBuySavings(
  units: ReadonlyMap<string, readonly number[]>,
  offers: readonly MultiBuyRule[],
): MultiBuySaving[] {
  const out: MultiBuySaving[] = [];
  for (const offer of offers) {
    const prices = offer.productIds.flatMap((id) => units.get(id) ?? []).sort((a, b) => b - a);
    if (!prices.length) continue;
    const group = offer.buyQty + offer.getQty;
    const times = Math.floor(prices.length / group);
    let discountCents = 0;
    for (let g = 0; g < times; g++) {
      const free = prices.slice(g * group + offer.buyQty, (g + 1) * group);
      discountCents += free.reduce(
        (sum, p) => sum + Math.round((p * Math.min(100, offer.percentOff)) / 100),
        0,
      );
    }
    const rest = prices.length - times * group;
    out.push({
      id: offer.id,
      buyQty: offer.buyQty,
      getQty: offer.getQty,
      percentOff: offer.percentOff,
      sellerId: offer.sellerId,
      times,
      discountCents,
      addMore: rest >= offer.buyQty ? group - rest : 0,
    });
  }
  return out;
}
