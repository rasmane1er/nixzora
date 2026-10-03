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

export const RecommendationsSchema = z.object({
  /** "history": based on what this shopper looked at; "popular": not enough history yet. */
  basis: z.enum(['history', 'popular']),
  products: z.array(ProductCardSchema),
  recentlyViewed: z.array(ProductCardSchema),
});
export type Recommendations = z.infer<typeof RecommendationsSchema>;
