import { z } from 'zod';
import { ProductCardSchema } from './catalog';

/**
 * A random id the browser or app keeps for a guest, so recommendations work before sign-in.
 * Opaque: never an IP address, email or device identifier.
 */
export const VisitorIdSchema = z.string().regex(/^[A-Za-z0-9_-]{16,64}$/, 'Invalid visitor id');

export const ProductViewEventSchema = z.object({
  productId: z.uuid(),
  visitorId: VisitorIdSchema.optional(),
});
export type ProductViewEvent = z.infer<typeof ProductViewEventSchema>;

/** Shown on a product page. Each list is empty when there is nothing good to show. */
export const RelatedProductsSchema = z.object({
  /** Closest products by what they are and do (semantic index). */
  similar: z.array(ProductCardSchema),
  /** Bought in the same orders. */
  boughtTogether: z.array(ProductCardSchema),
  /** Viewed by the same shoppers. */
  alsoViewed: z.array(ProductCardSchema),
});
export type RelatedProducts = z.infer<typeof RelatedProductsSchema>;

/**
 * Rows of picks that guess what a shopper needs, each from one signal (p10-02):
 * - still_thinking: products they came back to more than once and have not bought;
 * - interest: matches for something they searched for or told the assistant (`subject`);
 * - cart_addons: things that go with what is in their cart;
 * - accessories: things that go with something they bought (`subject` is its title);
 * - restock: things that run out, bought long enough ago;
 * - saved_deals: saved items that are now cheaper than when they were saved.
 */
export const SMART_ROW_KINDS = [
  'still_thinking',
  'interest',
  'cart_addons',
  'accessories',
  'restock',
  'saved_deals',
] as const;
export type SmartRowKind = (typeof SMART_ROW_KINDS)[number];

export const SmartRowSchema = z.object({
  kind: z.enum(SMART_ROW_KINDS),
  /** The search or need (interest), or the product bought (accessories); null otherwise. */
  subject: z.string().nullable(),
  /** Where an interest came from. */
  source: z.enum(['search', 'assistant']).nullable(),
  products: z.array(ProductCardSchema),
});
export type SmartRow = z.infer<typeof SmartRowSchema>;

export const RecommendationsSchema = z.object({
  /** "history": based on what this shopper looked at; "popular": not enough history yet. */
  basis: z.enum(['history', 'popular']),
  products: z.array(ProductCardSchema),
  recentlyViewed: z.array(ProductCardSchema),
  /** Best first, at most four; empty for new shoppers and when personalized picks are off. */
  rows: z.array(SmartRowSchema).default([]),
});
export type Recommendations = z.infer<typeof RecommendationsSchema>;

/** A search the shopper ran, for "Because you searched for…" (signed in, or by visitor id). */
export const SearchEventSchema = z.object({
  q: z.string().trim().min(2).max(200),
  visitorId: VisitorIdSchema.optional(),
});
export type SearchEvent = z.infer<typeof SearchEventSchema>;
