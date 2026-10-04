import { z } from 'zod';
import { CARRIERS } from './commerce';
import {
  ProductCardSchema,
  ProductCreateSchema,
  ProductStatusSchema,
  ProductUpdateSchema,
  SlugSchema,
} from './catalog';

// ───────────── Sellers (Phase 7, ADR-0012) ─────────────

/** Store addresses that would be confusing or impersonate NIXZORA. */
const RESERVED_HANDLES = new Set([
  'admin',
  'api',
  'help',
  'nixzora',
  'official',
  'sell',
  'seller',
  'sellers',
  'shop',
  'staff',
  'store',
  'support',
]);

/** The public store address: nixzora.com/s/<handle>. */
export const SellerHandleSchema = SlugSchema.pipe(
  z
    .string()
    .min(3, { message: 'Use at least 3 characters.' })
    .max(40, { message: 'Use at most 40 characters.' })
    .refine((handle) => !RESERVED_HANDLES.has(handle) && !handle.includes('nixzora'), {
      message: 'That store address is reserved. Choose another.',
    }),
);

export const SellerStatusSchema = z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED']);

/** Payouts go through Stripe Connect, which NIXZORA supports for US businesses first. */
export const SellerCountrySchema = z.enum(['US']);

export const SellerPayoutsSchema = z.object({
  /** "FAKE" (test mode, no money moves) or "STRIPE"; null until onboarding starts. */
  provider: z.enum(['FAKE', 'STRIPE']).nullable(),
  accountConnected: z.boolean(),
  detailsSubmitted: z.boolean(),
  payoutsEnabled: z.boolean(),
  requirementsDue: z.array(z.string()),
});

export const SellerListingCountsSchema = z.object({
  draft: z.number().int(),
  pendingReview: z.number().int(),
  active: z.number().int(),
  archived: z.number().int(),
});

export const SellerViewSchema = z.object({
  id: z.uuid(),
  handle: z.string(),
  displayName: z.string(),
  legalName: z.string(),
  contactEmail: z.string(),
  country: z.string(),
  description: z.string().nullable(),
  status: SellerStatusSchema,
  statusReason: z.string().nullable(),
  payouts: SellerPayoutsSchema,
  commissionBps: z.number().int(),
  payoutHoldDays: z.number().int(),
  listings: SellerListingCountsSchema,
  rating: z.object({ average: z.number().nullable(), count: z.number().int() }),
  approvedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  // Onboarding (p8-13). Null for stores that applied before it.
  businessType: z.string().nullable(),
  category: z.string().nullable(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  supportEmail: z.string().nullable(),
  supportPhone: z.string().nullable(),
  address: z
    .object({
      line1: z.string(),
      line2: z.string().nullable(),
      city: z.string(),
      region: z.string(),
      postalCode: z.string(),
      country: z.string(),
    })
    .nullable(),
  shipping: z.object({
    handlingDays: z.number().int(),
    carriers: z.array(z.string()),
    shipRegions: z.array(z.string()),
  }),
});

/** GET /seller/me: the caller's store, or null if they have not applied. */
export const SellerMeResponseSchema = z.object({
  seller: SellerViewSchema.nullable(),
  role: z.enum(['OWNER', 'STAFF']).nullable(),
});

export const PayoutOnboardingLinkSchema = z.object({ url: z.url() });

// ───────────── Seller listings ─────────────

/** Sellers never set status or slug directly: listings go through review (p7-03). */
export const SellerProductCreateSchema = ProductCreateSchema.omit({ status: true, slug: true });
export const SellerProductUpdateSchema = ProductUpdateSchema.omit({ status: true, slug: true });

export const SellerProductListQuerySchema = z.object({
  status: ProductStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const SellerProductRowSchema = ProductCardSchema.extend({
  status: ProductStatusSchema,
  reviewNote: z.string().nullable(),
  updatedAt: z.iso.datetime(),
});

// ───────────── Bulk listing import (p7-03) ─────────────

export const LISTING_IMPORT_COLUMNS = [
  'product',
  'title',
  'category',
  'description',
  'specs',
  'sku',
  'option',
  'price',
  'compare_at_price',
  'stock',
  'barcode',
] as const;

export const ListingImportRequestSchema = z.object({
  /** The CSV file's text. */
  csv: z
    .string()
    .min(1, { message: 'The file is empty.' })
    .max(1_000_000, { message: 'Files can be up to 1 MB (about 2,000 rows).' }),
  /** Check only: report what would happen and every error, change nothing. */
  dryRun: z.boolean().default(true),
});

export type ListingImportIssue = { row: number; column?: string; message: string };

export type ListingImportResult = {
  dryRun: boolean;
  rows: number;
  /** New draft listings (and their options) the file creates. */
  newListings: number;
  newOptions: number;
  /** Existing options whose price or stock the file changes. */
  updatedOptions: number;
  errors: ListingImportIssue[];
  /** Ids of the drafts created (empty on a dry run). */
  createdIds: string[];
};

export type ListingImportRequest = z.infer<typeof ListingImportRequestSchema>;

// ───────────── Seller orders and earnings (p7-04, p7-05) ─────────────

export const SellerOrderStatusSchema = z.enum(['PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED']);

export const SellerOrderListQuerySchema = z.object({
  status: SellerOrderStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const SellerOrderShipSchema = z.object({
  carrier: z.enum(CARRIERS),
  trackingNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{6,40}$/, { message: 'Enter the tracking number.' }),
});

export type SellerOrderView = {
  id: string;
  orderNumber: string;
  status: z.infer<typeof SellerOrderStatusSchema>;
  currency: string;
  placedAt: string | null;
  items: {
    id: string;
    productTitle: string;
    variantTitle: string;
    sku: string;
    quantity: number;
    unitPriceCents: number;
    totalCents: number;
  }[];
  itemsCents: number;
  shippingCents: number;
  commissionBps: number;
  commissionCents: number;
  netCents: number;
  refundedCents: number;
  /** Where to send it. Only what the label needs: no customer email or phone. */
  shipTo: {
    fullName: string;
    line1: string;
    line2?: string | null;
    city: string;
    region: string;
    postalCode: string;
    country: string;
  };
  tracking: { carrier: string; number: string; url: string | null } | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  /** Held by fraud checks (ADR-0024): do not ship until it is cleared. */
  underReview: boolean;
  /**
   * Shipped, but no carrier has scanned the tracking number yet: its earnings wait for the first
   * scan (p9-05). False before shipping and once scanned.
   */
  awaitingCarrierScan: boolean;
};

export type SellerBalance = {
  currency: string;
  /** Payouts paused by a fraud review (ADR-0024). */
  payoutsPaused: boolean;
  /** Net of paid orders the seller has not shipped yet. */
  pendingCents: number;
  /** Earned, waiting for the hold period to end. */
  onHoldCents: number;
  /** Shipped, waiting for the carrier's first scan before the hold period starts (p9-05). */
  awaitingScanCents: number;
  /** Can be paid out now (may be negative after refunds). */
  availableCents: number;
  /** All sales minus refunds, ever. */
  lifetimeNetCents: number;
  /** When the next held amount becomes available. */
  nextReleaseAt: string | null;
};

export type SellerLedgerEntryView = {
  id: string;
  type: 'SALE' | 'REFUND' | 'PAYOUT' | 'ADJUSTMENT';
  amountCents: number;
  description: string;
  orderNumber: string | null;
  availableAt: string;
  createdAt: string;
};

export const SellerAnalyticsQuerySchema = z.object({
  days: z.coerce
    .number()
    .int()
    .refine((d) => [7, 30, 90].includes(d), { message: 'Choose 7, 30 or 90 days.' })
    .default(30),
});

export type SellerAnalyticsTotals = {
  /** The store's item sales (before commission), excluding cancelled orders. */
  salesCents: number;
  orders: number;
  units: number;
  /** What the store earns from those orders (after commission). */
  netCents: number;
  refundedCents: number;
  /** Product page views of the store's listings. */
  views: number;
  /** Orders per 100 product views. */
  conversionPct: number | null;
};

export type SellerAnalytics = {
  days: number;
  currency: string;
  /** Days are counted in the store's time zone (US Eastern for now). */
  timeZone: string;
  totals: SellerAnalyticsTotals;
  /** The same figures for the period just before, for comparison. */
  previous: SellerAnalyticsTotals;
  daily: { date: string; salesCents: number; orders: number }[];
  topProducts: {
    productId: string;
    title: string;
    units: number;
    salesCents: number;
    views: number;
  }[];
};

export type SellerAnalyticsQuery = z.infer<typeof SellerAnalyticsQuerySchema>;

export type PayoutView = {
  id: string;
  amountCents: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'FAILED';
  failureReason: string | null;
  /** Sent by the daily run (true) or by a staff member (false). */
  automatic: boolean;
  createdAt: string;
  paidAt: string | null;
};

export type SellerOrderListQuery = z.infer<typeof SellerOrderListQuerySchema>;
export type SellerOrderShip = z.infer<typeof SellerOrderShipSchema>;

// ───────────── Ops Center ─────────────

export const AdminSellerListQuerySchema = z.object({
  status: SellerStatusSchema.optional(),
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const AdminSellerViewSchema = SellerViewSchema.extend({
  owner: z.object({ id: z.uuid(), email: z.string() }).nullable(),
  /** From the application; private, for staff review (p8-13). */
  verification: z
    .object({
      firstName: z.string(),
      lastName: z.string(),
      dateOfBirth: z.string().nullable(),
      phone: z.string(),
      residenceCountry: z.string(),
    })
    .nullable(),
  whatYouSell: z.string().nullable(),
  agreementsAcceptedAt: z.iso.datetime().nullable(),
});

export const AdminSellerStatusChangeSchema = z
  .object({
    status: z.enum(['ACTIVE', 'SUSPENDED', 'REJECTED']),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.status === 'ACTIVE' || (v.reason?.length ?? 0) >= 5, {
    message: 'Tell the seller why (at least 5 characters).',
    path: ['reason'],
  });

export const AdminSellerTermsSchema = z
  .object({
    commissionBps: z.number().int().min(0).max(5000),
    payoutHoldDays: z.number().int().min(0).max(90),
  })
  .partial();

export const ListingReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const ListingReviewRowSchema = SellerProductRowSchema.extend({
  seller: z.object({ id: z.uuid(), handle: z.string(), displayName: z.string() }),
});

export const ListingReviewDecisionSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REJECT']),
    note: z.string().trim().max(1000).optional(),
  })
  .refine((v) => v.decision === 'APPROVE' || (v.note?.length ?? 0) >= 5, {
    message: 'Tell the seller what to change (at least 5 characters).',
    path: ['note'],
  });

// ───────────── Storefront ─────────────

export const PublicSellerSchema = z.object({
  handle: z.string(),
  displayName: z.string(),
  description: z.string().nullable(),
  memberSince: z.iso.datetime(),
  productCount: z.number().int(),
  rating: z.object({ average: z.number().nullable(), count: z.number().int() }),
  category: z.string().nullable(),
  website: z.string().nullable(),
  logoUrl: z.string().nullable(),
  bannerUrl: z.string().nullable(),
  supportEmail: z.string().nullable(),
  /** Orders the store has shipped. */
  salesCount: z.number().int(),
  handlingDays: z.number().int(),
});

// ───────────── Ratings and returns in the seller portal (p7-07) ─────────────

export type SellerRatingView = {
  id: string;
  orderNumber: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SellerFeedback = {
  rating: {
    average: number | null;
    count: number;
    breakdown: Record<'1' | '2' | '3' | '4' | '5', number>;
  };
  ratings: SellerRatingView[];
  /** Return requests that include this store's items, newest first; only its own lines. */
  returns: {
    id: string;
    orderNumber: string;
    status: 'REQUESTED' | 'APPROVED' | 'REJECTED' | 'RECEIVED' | 'REFUNDED';
    reason: string;
    customerNote: string | null;
    staffNote: string | null;
    items: { orderItemId: string; quantity: number; productTitle: string; sku: string }[];
    createdAt: string;
    resolvedAt: string | null;
  }[];
};

export type SellerStatus = z.infer<typeof SellerStatusSchema>;
export type SellerView = z.infer<typeof SellerViewSchema>;
export type SellerMeResponse = z.infer<typeof SellerMeResponseSchema>;
export type PayoutOnboardingLink = z.infer<typeof PayoutOnboardingLinkSchema>;
export type SellerProductCreate = z.infer<typeof SellerProductCreateSchema>;
export type SellerProductUpdate = z.infer<typeof SellerProductUpdateSchema>;
export type SellerProductListQuery = z.infer<typeof SellerProductListQuerySchema>;
export type SellerProductRow = z.infer<typeof SellerProductRowSchema>;
export type AdminSellerListQuery = z.infer<typeof AdminSellerListQuerySchema>;
export type AdminSellerView = z.infer<typeof AdminSellerViewSchema>;
export type AdminSellerStatusChange = z.infer<typeof AdminSellerStatusChangeSchema>;
export type AdminSellerTerms = z.infer<typeof AdminSellerTermsSchema>;
export type ListingReviewQuery = z.infer<typeof ListingReviewQuerySchema>;
export type ListingReviewRow = z.infer<typeof ListingReviewRowSchema>;
export type ListingReviewDecision = z.infer<typeof ListingReviewDecisionSchema>;
export type PublicSeller = z.infer<typeof PublicSellerSchema>;
