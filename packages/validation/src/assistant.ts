import { z } from 'zod';
import { ProductCardSchema } from './catalog';

/** One turn of the shopping conversation. Only the shopper's words drive retrieval. */
export const AssistantMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().trim().min(1).max(1_000),
});
export type AssistantMessage = z.infer<typeof AssistantMessageSchema>;

export const AssistantChatRequestSchema = z.object({
  messages: z
    .array(AssistantMessageSchema)
    .min(1)
    .max(12)
    .refine((messages) => messages[messages.length - 1]?.role === 'user', {
      message: 'The last message must be from the shopper',
    }),
});
export type AssistantChatRequest = z.infer<typeof AssistantChatRequestSchema>;

/** What the assistant understood: shown to the shopper as editable chips. */
export const ShoppingNeedSchema = z.object({
  /** Category slug, when the request names a kind of product. */
  category: z.string().nullable(),
  categoryName: z.string().nullable(),
  minPriceCents: z.number().int().min(0).nullable(),
  maxPriceCents: z.number().int().min(0).nullable(),
  /** Qualities the shopper asked for, e.g. "quiet", "lightweight", "long battery life". */
  mustHave: z.array(z.string()).max(8),
  /** The words used to search the catalog. */
  query: z.string(),
});
export type ShoppingNeed = z.infer<typeof ShoppingNeedSchema>;

export const AssistantPickSchema = z.object({
  product: ProductCardSchema,
  /** e.g. "Best match", "Best value", "Lightest". */
  badge: z.string().nullable(),
  /** One sentence on why it fits, built from catalog facts. */
  reason: z.string(),
  /** The requested qualities this product has, from its specs. */
  matched: z.array(z.string()),
  /** Default variant to add to the cart: the cheapest in stock. */
  variantId: z.uuid().nullable(),
});
export type AssistantPick = z.infer<typeof AssistantPickSchema>;

export const ComparisonSchema = z.object({
  rows: z.array(
    z.object({
      label: z.string(),
      /** One value per pick, in the same order as `picks`; null when a product has no value. */
      values: z.array(z.string().nullable()),
    }),
  ),
});
export type Comparison = z.infer<typeof ComparisonSchema>;

export const AssistantChatResponseSchema = z.object({
  reply: z.string(),
  need: ShoppingNeedSchema,
  picks: z.array(AssistantPickSchema).max(4),
  comparison: ComparisonSchema.nullable(),
  /** Follow-up prompts the shopper can tap. */
  suggestions: z.array(z.string()).max(4),
  /** Constraints that were relaxed because nothing matched them all. */
  relaxed: z.array(z.string()),
  /** Which model wrote the reply: "local" or a Claude model id. */
  model: z.string(),
});
export type AssistantChatResponse = z.infer<typeof AssistantChatResponseSchema>;
