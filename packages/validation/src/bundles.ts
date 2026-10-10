import { z } from 'zod';
import { type ProductCard } from './catalog';

/**
 * Bundle & save (p10-16): 2 to 5 products sold together for a percentage off. Adding all of them
 * to the cart takes the percentage off that set; a store makes bundles of its own listings and
 * funds the discount, NIXZORA staff of NIXZORA's own. Only products with a single option can be
 * bundled, so "Add bundle to cart" never has to ask which size or colour.
 */
export const BUNDLE_MIN_ITEMS = 2;
export const BUNDLE_MAX_ITEMS = 5;
export const BUNDLE_MIN_PERCENT = 5;
export const BUNDLE_MAX_PERCENT = 30;

export const BundleCreateSchema = z.object({
  title: z.string().trim().min(3).max(80),
  percentOff: z.number().int().min(BUNDLE_MIN_PERCENT).max(BUNDLE_MAX_PERCENT),
  productIds: z
    .array(z.uuid())
    .min(BUNDLE_MIN_ITEMS)
    .max(BUNDLE_MAX_ITEMS)
    .refine((ids) => new Set(ids).size === ids.length, 'Each product once.'),
});
export type BundleCreate = z.infer<typeof BundleCreateSchema>;

export type BundleStatus = 'ACTIVE' | 'ARCHIVED';

export type BundleView = {
  id: string;
  title: string;
  percentOff: number;
  status: BundleStatus;
  products: ProductCard[];
  /** The products' prices added up, and the price together. */
  priceCents: number;
  bundlePriceCents: number;
  /** Every product is live, in stock and has one option: it can be added in one tap. */
  available: boolean;
  seller: { handle: string; displayName: string } | null;
  createdAt: string;
};

/** A bundle the cart completes: how many sets and what they saved. */
export type CartBundle = {
  id: string;
  title: string;
  percentOff: number;
  sets: number;
  discountCents: number;
};
