import { z } from 'zod';
import { EmailSchema } from './auth';
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

export const SellerApplicationSchema = z.object({
  displayName: z.string().trim().min(2).max(60),
  /** Generated from the store name when left out. */
  handle: SellerHandleSchema.optional(),
  legalName: z.string().trim().min(2).max(120),
  /** Defaults to the applicant's account email. */
  contactEmail: EmailSchema.optional(),
  country: SellerCountrySchema.default('US'),
  description: z.string().trim().max(1000).optional(),
  acceptTerms: z.literal(true, { message: 'Accept the seller terms to continue.' }),
});

export const SellerProfileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60),
    description: z.string().trim().max(1000).nullable(),
    contactEmail: EmailSchema,
  })
  .partial();

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
  approvedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
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
};

export type SellerBalance = {
  currency: string;
  /** Net of paid orders the seller has not shipped yet. */
  pendingCents: number;
  /** Earned, waiting for the hold period to end. */
  onHoldCents: number;
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
});

export type SellerStatus = z.infer<typeof SellerStatusSchema>;
export type SellerApplication = z.infer<typeof SellerApplicationSchema>;
export type SellerProfileUpdate = z.infer<typeof SellerProfileUpdateSchema>;
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
