import { z } from 'zod';
import { type ProductCard } from './catalog';

/**
 * Price history and browsing history (p10-19). A product's price history is its lowest live
 * price over time (a point at each change); browsing history is what a signed-in shopper
 * looked at, newest first, with what the price was then.
 */
export const PRICE_HISTORY_RANGES = [30, 90, 365] as const;
export type PriceHistoryRange = (typeof PRICE_HISTORY_RANGES)[number];

export const PriceHistoryQuerySchema = z.object({
  days: z.coerce
    .number()
    .refine((d) => (PRICE_HISTORY_RANGES as readonly number[]).includes(d))
    .default(90),
});

export type PriceHistory = {
  days: number;
  currency: string;
  /** Steps: the price from `at` until the next point (the first is the window's start, or when the product was listed). */
  points: { at: string; priceCents: number }[];
  /** When this was worked out: the right edge of the chart. */
  asOf: string;
  currentCents: number;
  lowestCents: number;
  highestCents: number;
  /** Time-weighted average over the window, rounded to the cent. */
  typicalCents: number;
  /** Today's price is the lowest of the last 30 days, and below the typical price. */
  lowestIn30Days: boolean;
  /** The price changed at least once in the window. */
  changed: boolean;
};

export type HistoryItem = {
  product: ProductCard;
  viewedAt: string;
  /** The price when it was last viewed (null before price history existed). */
  priceThenCents: number | null;
  /** How much cheaper it is now than then (0 when not). */
  droppedCents: number;
  /** A price-drop alert is on for it. */
  alertOn: boolean;
};

export type BrowsingHistory = {
  items: HistoryItem[];
  /** Personalized picks are off: nothing new is recorded (see Preferences). */
  paused: boolean;
};
