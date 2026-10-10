import { z } from 'zod';

/**
 * Refer a friend (p10-23). The friend gets a one-time code for their first order; the person
 * who invited them gets store credit once that order ships.
 */
export const REFERRAL_FRIEND_CENTS = 1000;
export const REFERRAL_REWARD_CENTS = 1000;
/** The friend's first order must reach this (after discounts) for either reward. */
export const REFERRAL_MIN_ORDER_CENTS = 2500;
/** Rewards per person per calendar year. */
export const REFERRAL_YEARLY_LIMIT = 10;
/** An invite can be claimed this long after creating the account, before any order. */
export const REFERRAL_CLAIM_DAYS = 7;
/** The friend's code expires after this many days. */
export const REFERRAL_CODE_DAYS = 60;

export const ReferralCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{6,12}$/, 'That invite code doesn’t look right.');

export const ReferralClaimSchema = z.object({ code: ReferralCodeSchema });
export type ReferralClaim = z.infer<typeof ReferralClaimSchema>;

export type ReferralInvite = {
  /** "Ada L." (first name and initial), or null when they didn't give a name. */
  name: string | null;
  status: 'PENDING' | 'REWARDED' | 'REJECTED';
  /** Why no reward, in plain words, when rejected. */
  reason: 'SAME_HOUSEHOLD' | 'YEARLY_LIMIT' | null;
  joinedAt: string;
  rewardedAt: string | null;
};

export type ReferralView = {
  code: string;
  /** The link to share. */
  link: string;
  friendCents: number;
  rewardCents: number;
  minOrderCents: number;
  yearlyLimit: number;
  rewardedThisYear: number;
  earnedCents: number;
  invites: ReferralInvite[];
  /** Your own welcome code, when someone invited you. */
  welcome: { code: string; amountCents: number; endsAt: string; used: boolean } | null;
  /** A new account with no orders can still enter a friend's code. */
  canClaim: boolean;
};

/** What the invite page shows before signing up (no personal data beyond a first name). */
export type ReferralInvitePreview = {
  firstName: string | null;
  friendCents: number;
  minOrderCents: number;
};
