import { type Cart } from './commerce';

/** Saved for later (p10-21): at most this many items per account. */
export const MAX_SAVED_ITEMS = 100;

/** A cart item set aside on the account, priced as it is now. */
export type SavedItem = {
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  imageUrl: string | null;
  /** Today's price (the member price for NIXZORA Plus members). */
  priceCents: number;
  currency: string;
  /** The price when it was saved: the difference is shown as a drop or a rise. */
  savedPriceCents: number;
  quantity: number;
  savedAt: string;
  /** Sold out or no longer sold: it stays saved but can't go back to the cart yet. */
  problem: 'UNAVAILABLE' | null;
};

/** Moving between the cart and the saved list changes both. */
export type CartAndSaved = { cart: Cart; saved: SavedItem[] };
