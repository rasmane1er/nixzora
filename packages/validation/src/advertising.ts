import { z } from 'zod';
import { ProductCardSchema } from './catalog';
import { VisitorIdSchema } from './recommendations';

/**
 * Sponsored products (p10-01): sellers promote their own listings next to matching results. Ads
 * are first party, always labelled "Sponsored", and chosen by what is on the page (a search, a
 * category, a product) or by the shopper's own NIXZORA activity; no outside ad network, no
 * tracking across sites. Sellers pay per click from their earnings (or ad credit).
 */

/** Cheapest click, and the most a seller can bid for one. */
export const AD_MIN_BID_CENTS = 10;
export const AD_MAX_BID_CENTS = 2000;
/** Smallest and largest daily budget. */
export const AD_MIN_DAILY_BUDGET_CENTS = 100;
export const AD_MAX_DAILY_BUDGET_CENTS = 100_000;
/** Products one campaign can promote. */
export const AD_MAX_PRODUCTS = 50;

/** Where an ad is shown. */
export const AD_PLACEMENTS = ['search', 'category', 'product', 'home'] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

export const AdQuerySchema = z
  .object({
    placement: z.enum(AD_PLACEMENTS),
    /** The search (placement "search"). */
    q: z.string().trim().min(1).max(200).optional(),
    /** The category slug (placement "category"). */
    category: z.string().trim().min(1).max(80).optional(),
    /** The product being viewed (placement "product"). */
    product: z.string().trim().min(1).max(160).optional(),
    visitorId: VisitorIdSchema.optional(),
    limit: z.coerce.number().int().min(1).max(8).optional(),
  })
  .refine((v) => v.placement !== 'search' || v.q, { message: 'q is required', path: ['q'] })
  .refine((v) => v.placement !== 'category' || v.category, {
    message: 'category is required',
    path: ['category'],
  })
  .refine((v) => v.placement !== 'product' || v.product, {
    message: 'product is required',
    path: ['product'],
  });
export type AdQuery = z.infer<typeof AdQuerySchema>;

export const SponsoredProductSchema = z.object({
  product: ProductCardSchema,
  /** Opaque, signed and short-lived: send it back when the shopper opens the ad. */
  token: z.string(),
});
export type SponsoredProduct = z.infer<typeof SponsoredProductSchema>;

export const SponsoredProductsSchema = z.object({ ads: z.array(SponsoredProductSchema) });
export type SponsoredProducts = z.infer<typeof SponsoredProductsSchema>;

export const AdClickSchema = z.object({
  token: z.string().min(20).max(600),
  visitorId: VisitorIdSchema.optional(),
});
export type AdClick = z.infer<typeof AdClickSchema>;
export type AdClickResult = { slug: string };

// ───── Seller portal ─────

export const AD_CAMPAIGN_STATUSES = ['ACTIVE', 'PAUSED', 'SUSPENDED'] as const;
export type AdCampaignStatus = (typeof AD_CAMPAIGN_STATUSES)[number];

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const AdCampaignCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  productIds: z.array(z.uuid()).min(1).max(AD_MAX_PRODUCTS),
  dailyBudgetCents: z.number().int().min(AD_MIN_DAILY_BUDGET_CENTS).max(AD_MAX_DAILY_BUDGET_CENTS),
  bidCents: z.number().int().min(AD_MIN_BID_CENTS).max(AD_MAX_BID_CENTS),
  /** Last day the campaign runs (UTC); none runs until paused. */
  endsOn: day.nullable().optional(),
});
export type AdCampaignCreate = z.infer<typeof AdCampaignCreateSchema>;

export const AdCampaignUpdateSchema = AdCampaignCreateSchema.partial().extend({
  /** Sellers pause and resume; only staff suspend. */
  status: z.enum(['ACTIVE', 'PAUSED']).optional(),
});
export type AdCampaignUpdate = z.infer<typeof AdCampaignUpdateSchema>;

export type AdStats = { impressions: number; clicks: number; spendCents: number };

export type AdCampaignView = {
  id: string;
  name: string;
  status: AdCampaignStatus;
  /** Why staff suspended it, shown to the seller. */
  suspendedReason: string | null;
  dailyBudgetCents: number;
  bidCents: number;
  endsOn: string | null;
  /** True when the end date has passed. */
  ended: boolean;
  products: { id: string; slug: string; title: string; imageUrl: string | null }[];
  today: AdStats;
  last30Days: AdStats;
  createdAt: string;
};

export type SellerAdsOverview = {
  /** Promotional credit from NIXZORA, spent before earnings. */
  creditCents: number;
  /** Credit plus earnings, minus clicks not yet charged: what ads can still spend. */
  fundsCents: number;
  /** Clicks not yet charged to the earnings ledger (charged hourly and before each payout). */
  unbilledCents: number;
  campaigns: AdCampaignView[];
  /** The last 14 days, oldest first, every campaign together. */
  daily: (AdStats & { day: string })[];
  /** Products the seller can promote (active listings). */
  promotable: { id: string; slug: string; title: string; imageUrl: string | null }[];
};

// ───── Ops ─────

export type AdminAdCampaignView = AdCampaignView & {
  seller: { id: string; handle: string; displayName: string };
};

export type AdSellerCredit = {
  id: string;
  handle: string;
  displayName: string;
  creditCents: number;
};

export const AdCampaignSuspendSchema = z.object({ reason: z.string().trim().min(3).max(300) });
export type AdCampaignSuspend = z.infer<typeof AdCampaignSuspendSchema>;

export const AdCreditGrantSchema = z.object({
  amountCents: z.number().int().min(100).max(100_000),
  note: z.string().trim().min(3).max(200),
});
export type AdCreditGrant = z.infer<typeof AdCreditGrantSchema>;
