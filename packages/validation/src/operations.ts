import { z } from 'zod';

// ───────────── Reviews ─────────────

export const ReviewCreateSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().trim().min(3).max(120),
  body: z
    .string()
    .trim()
    .min(20, { message: 'Tell other shoppers a little more (20+ characters).' })
    .max(5000),
  /** Up to four uploaded photos (p10-05), in order; replaces the earlier ones when editing. */
  photoKeys: z
    .array(z.string().regex(/^products\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/))
    .max(4)
    .optional(),
});

export const ReviewStatusSchema = z.enum(['PENDING', 'APPROVED', 'REJECTED']);

export const ReviewModerationSchema = z.object({
  status: z.enum(['APPROVED', 'REJECTED']),
});

export const AdminReviewQuerySchema = z.object({
  status: ReviewStatusSchema.default('PENDING'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ReviewView = {
  id: string;
  rating: number;
  title: string;
  body: string;
  author: string;
  verifiedPurchase: boolean;
  createdAt: string;
  /** Shoppers' photos (p10-05). */
  photos: { url: string }[];
  /** "Was this helpful?" yes votes. */
  helpfulCount: number;
};

export type RatingSummary = {
  average: number | null;
  count: number;
  /** Count per star, index 0 = 1 star. */
  distribution: [number, number, number, number, number];
};

/**
 * How a product's reviews are ordered: verified buyers and the most helpful first, then newest
 * ("relevant"); or the most helpful, newest, highest or lowest rated.
 */
export const REVIEW_SORTS = ['relevant', 'helpful', 'newest', 'highest', 'lowest'] as const;
export type ReviewSort = (typeof REVIEW_SORTS)[number];

export const ReviewListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  sort: z.enum(REVIEW_SORTS).default('relevant'),
  /** Only reviews with this many stars. */
  rating: z.coerce.number().int().min(1).max(5).optional(),
  /** Only reviews with photos. */
  withPhotos: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
});
export type ReviewListQuery = z.infer<typeof ReviewListQuerySchema>;

/** One page of a product's approved reviews; the summary always covers all of them. */
export type ReviewPage = {
  summary: RatingSummary;
  reviews: ReviewView[];
  page: number;
  totalPages: number;
  /** Reviews matching the star filter (all reviews when there is none). */
  total: number;
};

/** "What customers say" (p6-04). Every number comes from the reviews, not from a model. */
export const ReviewInsightsSchema = z.object({
  summary: z.string(),
  pros: z.array(z.object({ label: z.string(), mentions: z.number().int() })),
  cons: z.array(z.object({ label: z.string(), mentions: z.number().int() })),
  reviewCount: z.number().int(),
  averageRating: z.number(),
  positivePercent: z.number().int(),
  /** True when a language model wrote the summary sentence (shown as an AI label). */
  aiWritten: z.boolean(),
  generatedAt: z.iso.datetime(),
});
export type ReviewInsights = z.infer<typeof ReviewInsightsSchema>;

/** A draft product description for staff (p6-03); never saved without review. */
export const ProductCopySuggestionSchema = z.object({
  description: z.string(),
  /** True when a language model wrote it (it passed the fact check). */
  aiWritten: z.boolean(),
  model: z.string(),
  /** Why the AI draft was not used, when it was not. */
  notes: z.array(z.string()),
});
export type ProductCopySuggestion = z.infer<typeof ProductCopySuggestionSchema>;

// ───────────── Questions and answers (p10-05) ─────────────

export const QuestionCreateSchema = z.object({
  body: z
    .string()
    .trim()
    .min(10, { message: 'Ask a full question (10+ characters).' })
    .max(500),
});
export type QuestionCreate = z.infer<typeof QuestionCreateSchema>;

export const AnswerCreateSchema = z.object({ body: z.string().trim().min(2).max(1000) });
export type AnswerCreate = z.infer<typeof AnswerCreateSchema>;

export const QuestionListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(500).default(1),
  /** Search the questions and answers. */
  q: z.string().trim().max(100).optional(),
});
export type QuestionListQuery = z.infer<typeof QuestionListQuerySchema>;

/** Who answered: the store selling it, NIXZORA staff, or a customer who bought it. */
export type AnswerRole = 'SELLER' | 'STAFF' | 'BUYER';

export type AnswerView = {
  id: string;
  body: string;
  role: AnswerRole;
  /** The store's name, "NIXZORA", or the buyer's first name and initial. */
  author: string;
  createdAt: string;
};

export type QuestionView = {
  id: string;
  body: string;
  author: string;
  createdAt: string;
  answers: AnswerView[];
};

export type QuestionPage = {
  questions: QuestionView[];
  page: number;
  totalPages: number;
  total: number;
  /** For the signed-in shopper: may they answer (the seller, staff, or a buyer of it)? */
  canAnswer: boolean;
};

/** Ops and seller lists: the question with its product. */
export type QuestionWithProduct = QuestionView & {
  status: 'PUBLISHED' | 'HIDDEN';
  product: { id: string; slug: string; title: string };
};

export type AdminReviewView = ReviewView & {
  status: z.infer<typeof ReviewStatusSchema>;
  product: { id: string; slug: string; title: string };
  authorEmail: string;
};

// ───────────── Coupons ─────────────

export const CouponCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9][A-Z0-9-]{2,31}$/, { message: 'Codes use 3–32 letters, numbers and hyphens.' });

export const CouponCreateSchema = z
  .object({
    code: CouponCodeSchema,
    description: z.string().trim().max(200).optional(),
    type: z.enum(['PERCENT', 'FIXED']),
    /** PERCENT: basis points (1500 = 15%). FIXED: cents. */
    value: z.number().int().min(1),
    minSubtotalCents: z.number().int().min(0).max(100_000_000).default(0),
    maxRedemptions: z.number().int().min(1).nullable().optional(),
    startsAt: z.iso.datetime().nullable().optional(),
    endsAt: z.iso.datetime().nullable().optional(),
    isActive: z.boolean().default(true),
    /** Listed in customers' accounts under Coupons & promotions. */
    isPublic: z.boolean().default(false),
  })
  .refine((c) => c.type !== 'PERCENT' || c.value <= 9000, {
    message: 'Percentage discounts can be at most 90%.',
    path: ['value'],
  })
  .refine((c) => !c.startsAt || !c.endsAt || c.startsAt < c.endsAt, {
    message: 'The end must be after the start.',
    path: ['endsAt'],
  });

export const CouponUpdateSchema = z.object({
  description: z.string().trim().max(200).nullable().optional(),
  maxRedemptions: z.number().int().min(1).nullable().optional(),
  endsAt: z.iso.datetime().nullable().optional(),
  isActive: z.boolean().optional(),
  isPublic: z.boolean().optional(),
});

export const ApplyCouponSchema = z.object({ code: CouponCodeSchema });

export type CouponView = {
  id: string;
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minSubtotalCents: number;
  maxRedemptions: number | null;
  redemptionCount: number;
  startsAt: string | null;
  endsAt: string | null;
  isActive: boolean;
  isPublic: boolean;
  createdAt: string;
};

// ───────────── Customers ─────────────

export const CustomerNoteCreateSchema = z.object({
  body: z.string().trim().min(2).max(4000),
});

export type CustomerNoteView = {
  id: string;
  body: string;
  authorEmail: string;
  createdAt: string;
};

// ───────────── Refunds and returns ─────────────

export const RefundRequestSchema = z.object({
  amountCents: z.number().int().min(1),
  reason: z.string().trim().min(3).max(300),
  /** Put these units back in stock (e.g. the item came back unopened). */
  restock: z
    .array(z.object({ orderItemId: z.uuid(), quantity: z.number().int().min(1).max(100) }))
    .max(100)
    .default([]),
});

export const ReturnItemSchema = z.object({
  orderItemId: z.uuid(),
  quantity: z.number().int().min(1).max(100),
});

export const ReturnCreateSchema = z.object({
  reason: z.enum(['DAMAGED', 'NOT_AS_DESCRIBED', 'WRONG_ITEM', 'NO_LONGER_NEEDED', 'OTHER']),
  note: z.string().trim().max(1000).optional(),
  items: z.array(ReturnItemSchema).min(1).max(100),
});

export const ReturnStatusSchema = z.enum([
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'RECEIVED',
  'REFUNDED',
]);

export const ReturnDecisionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('approve'), note: z.string().trim().max(1000).optional() }),
  z.object({ action: z.literal('reject'), note: z.string().trim().min(3).max(1000) }),
  /** Items arrived: refund them (amount computed from what was paid) and restock if resellable. */
  z.object({ action: z.literal('receive'), restock: z.boolean().default(true) }),
]);

export const RETURN_WINDOW_DAYS = 30;

export type ReturnView = {
  id: string;
  orderId: string;
  orderNumber: string;
  status: z.infer<typeof ReturnStatusSchema>;
  reason: string;
  customerNote: string | null;
  staffNote: string | null;
  items: { orderItemId: string; quantity: number; productTitle: string; sku: string }[];
  refundCents: number | null;
  createdAt: string;
  resolvedAt: string | null;
};

export const AdminReturnQuerySchema = z.object({
  status: ReturnStatusSchema.optional(),
});

// ───────────── Shipping labels ─────────────

export const LabelPurchaseSchema = z.object({
  /** Parcel size in inches and weight in ounces. Defaults suit a laptop box. */
  lengthIn: z.number().min(1).max(108).default(18),
  widthIn: z.number().min(1).max(108).default(14),
  heightIn: z.number().min(1).max(108).default(4),
  weightOz: z.number().min(1).max(2400).default(96),
});

export type ReviewCreate = z.infer<typeof ReviewCreateSchema>;
export type ReviewModeration = z.infer<typeof ReviewModerationSchema>;
export type AdminReviewQuery = z.infer<typeof AdminReviewQuerySchema>;
export type CouponCreate = z.infer<typeof CouponCreateSchema>;
export type CouponUpdate = z.infer<typeof CouponUpdateSchema>;
export type ApplyCoupon = z.infer<typeof ApplyCouponSchema>;
export type CustomerNoteCreate = z.infer<typeof CustomerNoteCreateSchema>;
export type RefundRequest = z.infer<typeof RefundRequestSchema>;
export type ReturnCreate = z.infer<typeof ReturnCreateSchema>;
export type ReturnDecision = z.infer<typeof ReturnDecisionSchema>;
export type AdminReturnQuery = z.infer<typeof AdminReturnQuerySchema>;
export type LabelPurchase = z.infer<typeof LabelPurchaseSchema>;

// ───────────── Fraud signals (ADR-0024) ─────────────

export const RISK_SIGNAL_CODES = [
  'ip_velocity',
  'email_velocity',
  'emails_per_ip',
  'failed_payments',
  'prior_fraud',
  'new_account_high_value',
  'guest_high_value',
  'high_value',
  'above_usual',
  'bulk_quantity',
  'disposable_email',
  'trusted_customer',
  'radar_elevated',
  'radar_highest',
  'chargeback',
  'new_store_large_payout',
  'refund_rate',
  'sales_spike',
  'self_purchase',
  'store_chargebacks',
  'store_fraud_orders',
  'tracking_not_scanned',
] as const;
export type RiskSignalCode = (typeof RISK_SIGNAL_CODES)[number];

export const RiskSubjectSchema = z.enum(['CHECKOUT', 'PAYOUT', 'CHARGEBACK']);
export const RiskDecisionSchema = z.enum(['ALLOW', 'REVIEW', 'BLOCK']);
export const RiskReviewStatusSchema = z.enum(['OPEN', 'CLEARED', 'CONFIRMED']);

export type RiskSignal = {
  code: RiskSignalCode;
  /** Added to the score (negative for signals that lower it). */
  points: number;
  /** Numbers behind the signal, for the reviewer (counts, amounts in cents). */
  values?: Record<string, number | string>;
};

export type RiskAssessmentView = {
  id: string;
  subject: z.infer<typeof RiskSubjectSchema>;
  score: number;
  decision: z.infer<typeof RiskDecisionSchema>;
  signals: RiskSignal[];
  enforced: boolean;
  status: z.infer<typeof RiskReviewStatusSchema> | null;
  amountCents: number | null;
  currency: string;
  order: { id: string; number: string; status: string; email: string; riskHold: boolean } | null;
  seller: { id: string; handle: string; displayName: string; payoutsHeld: boolean } | null;
  email: string | null;
  ipAddress: string | null;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string | null;
  createdAt: string;
};

export const AdminRiskQuerySchema = z.object({
  status: RiskReviewStatusSchema.optional(),
  decision: RiskDecisionSchema.optional(),
  subject: RiskSubjectSchema.optional(),
  orderId: z.uuid().optional(),
  sellerId: z.uuid().optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
});

/** Clear: release the hold. Confirm: it was fraud (a paid order is cancelled and refunded). */
export const RiskReviewSchema = z.object({
  outcome: z.enum(['clear', 'confirm']),
  note: z.string().trim().max(1000).optional(),
});

export type AdminRiskQuery = z.infer<typeof AdminRiskQuerySchema>;
export type RiskReview = z.infer<typeof RiskReviewSchema>;

// ───────────── Alerts (p10-06) ─────────────

export type ProductAlertKind = 'BACK_IN_STOCK' | 'PRICE_DROP';
export type ProductAlertRef = { productId: string; kind: ProductAlertKind };
