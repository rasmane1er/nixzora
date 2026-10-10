import { z } from 'zod';
import { type ProductCard } from './catalog';

/** Lists and registries (p10-08): named lists besides "Saved", shareable by a private link. */
export const SHOPPING_LIST_KINDS = ['LIST', 'REGISTRY'] as const;
export type ShoppingListKind = (typeof SHOPPING_LIST_KINDS)[number];
/** Lists a customer can have, and products on one list. */
export const MAX_LISTS = 30;
export const MAX_LIST_ITEMS = 200;

export const ShoppingListCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(SHOPPING_LIST_KINDS).default('LIST'),
  /** Registries: the occasion's date, YYYY-MM-DD. */
  eventDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  note: z.string().trim().max(300).nullable().optional(),
  isShared: z.boolean().optional(),
});
export type ShoppingListCreate = z.infer<typeof ShoppingListCreateSchema>;

export const ShoppingListUpdateSchema = ShoppingListCreateSchema.partial();
export type ShoppingListUpdate = z.infer<typeof ShoppingListUpdateSchema>;

export const ShoppingListItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(99).optional(),
  note: z.string().trim().max(200).nullable().optional(),
});
export type ShoppingListItemInput = z.infer<typeof ShoppingListItemSchema>;

export type ShoppingListSummary = {
  id: string;
  name: string;
  kind: ShoppingListKind;
  eventDate: string | null;
  isShared: boolean;
  /** The private link's token: /lists/<token>; only works while shared. */
  shareToken: string;
  itemCount: number;
  /** Up to four product photos for the list's tile. */
  previews: string[];
};

export type ShoppingListView = ShoppingListSummary & {
  note: string | null;
  items: { product: ProductCard; quantity: number; note: string | null; addedAt: string }[];
};

/** What a guest sees through a shared link: the owner's first name, never their email. */
export type SharedListView = Omit<ShoppingListView, 'shareToken' | 'isShared'> & { owner: string };
