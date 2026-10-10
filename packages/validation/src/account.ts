import { z } from 'zod';
import { type OrderStatus } from './commerce';

// ───────────── The customer's account hub (Your Account) ─────────────

export const ProfileUpdateSchema = z.object({
  firstName: z.string().trim().min(1).max(60).nullable().optional(),
  lastName: z.string().trim().min(1).max(60).nullable().optional(),
  /** E.164-ish: digits, spaces, dashes, parentheses and a leading +. */
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()-]{7,20}$/, 'Enter a phone number with 7 to 20 digits.')
    .nullable()
    .optional(),
});

export const AccountPreferencesSchema = z.object({
  /** Deals, new arrivals and the occasional newsletter. Off until the customer opts in. */
  marketingEmails: z.boolean(),
  /** An email after delivery asking how the product is. */
  reviewRequests: z.boolean(),
  /**
   * Picks based on what the customer views, searches, saves, buys and tells the assistant. On by
   * default; turning it off also stops recording those signals. Optional on save (older apps).
   */
  personalizedPicks: z.boolean().optional(),
  /** Back-in-stock and price-drop alerts by push and email (p10-06). Optional on save. */
  stockAlerts: z.boolean().optional(),
});

export const ORDER_FILTERS = ['all', 'open', 'delivered', 'cancelled', 'returns'] as const;

export const AccountOrderQuerySchema = z.object({
  filter: z.enum(ORDER_FILTERS).default('all'),
  /** Order number, or words from a product title. */
  q: z.string().trim().max(100).optional(),
  /** Placed within the last N days (30, 90 or 365); omitted = any time. */
  days: z.coerce
    .number()
    .int()
    .refine((d) => [30, 90, 365].includes(d))
    .optional(),
  page: z.coerce.number().int().min(1).max(200).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
});

export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export type AccountPreferences = z.infer<typeof AccountPreferencesSchema>;
export type AccountOrderQuery = z.infer<typeof AccountOrderQuerySchema>;
export type OrderFilter = (typeof ORDER_FILTERS)[number];

export type AccountProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  avatarUrl: string | null;
  memberSince: string;
  /** "en", "fr" or "es". */
  language: string;
};

/** One line of an order in the order history, with what is needed to act on it. */
export type AccountOrderLine = {
  orderItemId: string;
  productTitle: string;
  variantTitle: string;
  quantity: number;
  totalCents: number;
  imageUrl: string | null;
  /** Null when the product is no longer sold. */
  productSlug: string | null;
  /** The product can be bought again (still on sale with this variant active). */
  variantId: string | null;
  canBuyAgain: boolean;
  /** Delivered and not reviewed yet. */
  canReview: boolean;
  seller: { handle: string; displayName: string } | null;
};

export type AccountOrder = {
  id: string;
  number: string;
  status: OrderStatus;
  currency: string;
  totalCents: number;
  itemCount: number;
  placedAt: string | null;
  createdAt: string;
  deliveredAt: string | null;
  shipTo: string;
  tracking: { carrier: string; number: string; url: string | null } | null;
  returnableUntil: string | null;
  openReturns: number;
  lines: AccountOrderLine[];
};

export type BuyAgainItem = {
  productId: string;
  slug: string;
  title: string;
  variantId: string;
  variantTitle: string;
  priceCents: number;
  currency: string;
  imageUrl: string | null;
  inStock: boolean;
  lastOrderedAt: string;
};

export type AccountReview = {
  id: string;
  rating: number;
  title: string;
  body: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  verifiedPurchase: boolean;
  createdAt: string;
  product: { title: string; slug: string; imageUrl: string | null };
};

export type AccountOverview = {
  profile: AccountProfile;
  counts: {
    openOrders: number;
    orders: number;
    openReturns: number;
    wishlist: number;
    reviews: number;
    addresses: number;
    /** Delivered products not reviewed yet. */
    toReview: number;
  };
  recentOrders: AccountOrder[];
  buyAgain: BuyAgainItem[];
  security: { mfaEnabled: boolean; hasPassword: boolean; activeSessions: number };
  seller: { handle: string; displayName: string } | null;
};

// ───────────── Profile photo ─────────────

export const AvatarSetSchema = z.object({
  storageKey: z.string().regex(/^products\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.(jpg|png|webp|avif)$/),
});
export type AvatarSet = z.infer<typeof AvatarSetSchema>;

// ───────────── Coupons in the account ─────────────

export type AccountCoupon = {
  code: string;
  description: string | null;
  type: 'PERCENT' | 'FIXED';
  value: number;
  minSubtotalCents: number;
  endsAt: string | null;
  /** The customer already used it on an order. */
  used: boolean;
};

// ───────────── Customer support ─────────────

export const SUPPORT_TOPICS = [
  'ORDER',
  'DELIVERY',
  'RETURN',
  'PAYMENT',
  'ACCOUNT',
  'PRODUCT',
  'PROBLEM',
  'OTHER',
] as const;

export const SUPPORT_TOPIC_LABEL: Record<(typeof SUPPORT_TOPICS)[number], string> = {
  ORDER: 'An order',
  DELIVERY: 'Delivery or tracking',
  RETURN: 'A return or refund',
  PAYMENT: 'Payment or billing',
  ACCOUNT: 'My account',
  PRODUCT: 'A product question',
  PROBLEM: 'Report a problem with the site or app',
  OTHER: 'Something else',
};

export const SupportRequestCreateSchema = z.object({
  topic: z.enum(SUPPORT_TOPICS),
  /** Required when signed out; signed-in customers use their account email. */
  email: z.email().max(254).optional(),
  name: z.string().trim().max(120).optional(),
  orderNumber: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^NX-[A-Z0-9]{6}$/, 'Order numbers look like NX-7KQ4M2.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  subject: z.string().trim().min(3).max(150),
  message: z.string().trim().min(10).max(5000),
  pageUrl: z.string().trim().max(500).optional(),
});

export const SupportReplySchema = z.object({
  reply: z.string().trim().min(2).max(5000).optional(),
  status: z.enum(['OPEN', 'ANSWERED', 'CLOSED']),
});

export type SupportRequestCreate = z.infer<typeof SupportRequestCreateSchema>;
export type SupportReply = z.infer<typeof SupportReplySchema>;
export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export type SupportRequestView = {
  id: string;
  reference: string;
  topic: SupportTopic;
  email: string;
  name: string | null;
  orderNumber: string | null;
  subject: string;
  message: string;
  status: 'OPEN' | 'ANSWERED' | 'CLOSED';
  staffReply: string | null;
  pageUrl: string | null;
  createdAt: string;
  answeredAt: string | null;
};

/** PUT /me/language */
export const LanguageUpdateSchema = z.object({ language: z.enum(['en', 'fr', 'es']) });
export type LanguageUpdate = z.infer<typeof LanguageUpdateSchema>;
