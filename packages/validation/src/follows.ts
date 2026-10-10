import { z } from 'zod';
import { type ProductCard } from './catalog';

/** Follow stores (p10-24). */
export const MAX_FOLLOWED_STORES = 200;

export const FollowUpdateSchema = z.object({ notify: z.boolean() });
export type FollowUpdate = z.infer<typeof FollowUpdateSchema>;

export type FollowedStore = {
  handle: string;
  displayName: string;
  logoUrl: string | null;
  followedAt: string;
  /** Push a notification when the store starts a deal. */
  notify: boolean;
  /** Listings added in the last 7 days. */
  newCount: number;
};

/** Whether the viewer follows a store, and how many people do. */
export type FollowStatus = { following: boolean; notify: boolean; followers: number };

/** The Following page: new listings and live deals from the stores you follow. */
export type FollowingFeed = {
  stores: FollowedStore[];
  /** Added in the last 30 days, newest first. */
  newArrivals: (ProductCard & { store: { handle: string; displayName: string } })[];
  /** On a deal right now. */
  deals: (ProductCard & { store: { handle: string; displayName: string } })[];
};
