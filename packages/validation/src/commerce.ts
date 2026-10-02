import { z } from 'zod';
import { EmailSchema } from './auth';

// ───────────── Addresses ─────────────

/** Launch market: the United States (50 states + DC). */
export const US_STATES = [
  'AL',
  'AK',
  'AZ',
  'AR',
  'CA',
  'CO',
  'CT',
  'DE',
  'DC',
  'FL',
  'GA',
  'HI',
  'ID',
  'IL',
  'IN',
  'IA',
  'KS',
  'KY',
  'LA',
  'ME',
  'MD',
  'MA',
  'MI',
  'MN',
  'MS',
  'MO',
  'MT',
  'NE',
  'NV',
  'NH',
  'NJ',
  'NM',
  'NY',
  'NC',
  'ND',
  'OH',
  'OK',
  'OR',
  'PA',
  'RI',
  'SC',
  'SD',
  'TN',
  'TX',
  'UT',
  'VT',
  'VA',
  'WA',
  'WV',
  'WI',
  'WY',
] as const;

export const AddressSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  line1: z.string().trim().min(3).max(200),
  line2: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || undefined),
  city: z.string().trim().min(2).max(100),
  region: z.enum(US_STATES, { message: 'Choose a US state.' }),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, { message: 'Enter a 5-digit ZIP code.' }),
  country: z.literal('US', { message: 'We ship within the United States for now.' }),
  phone: z
    .string()
    .trim()
    .regex(/^[+\d][\d\s().-]{6,24}$/, { message: 'Enter a valid phone number.' })
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export const AddressCreateSchema = AddressSchema.extend({
  label: z.string().trim().max(40).optional(),
  isDefaultShipping: z.boolean().optional(),
});
export const AddressUpdateSchema = AddressCreateSchema.partial();

export const SavedAddressSchema = AddressSchema.extend({
  id: z.uuid(),
  label: z.string().nullable(),
  isDefaultShipping: z.boolean(),
});

// ───────────── Cart ─────────────

/** Opaque guest cart id: 32 random bytes, base64url. */
export const CartIdSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/, { message: 'Invalid cart.' });

export const CartItemAddSchema = z.object({
  variantId: z.uuid(),
  quantity: z.number().int().min(1).max(20).default(1),
});

export const CartItemUpdateSchema = z.object({
  /** 0 removes the line. */
  quantity: z.number().int().min(0).max(20),
});

export const CartMergeSchema = z.object({ guestCartId: CartIdSchema });

export type CartLine = {
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  sku: string;
  options: Record<string, string>;
  imageUrl: string | null;
  unitPriceCents: number;
  compareAtCents: number | null;
  quantity: number;
  lineTotalCents: number;
  available: number;
  /** Set when the line cannot be bought as is (sold out, fewer left, or removed). */
  problem: 'UNAVAILABLE' | 'INSUFFICIENT_STOCK' | null;
};

export type Totals = {
  currency: string;
  subtotalCents: number;
  /** Coupon discount, already subtracted from the total. */
  discountCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  /** Spend this much more for free shipping (0 when already free). */
  freeShippingRemainingCents: number;
};

export type Cart = {
  /** Present for guest carts; signed-in carts belong to the account. */
  cartId: string | null;
  lines: CartLine[];
  itemCount: number;
  totals: Totals;
  /** The applied coupon, or why the one entered no longer applies. */
  coupon: { code: string; description: string | null; problem: string | null } | null;
};

// ───────────── Checkout and orders ─────────────

export const CheckoutRequestSchema = z.object({
  cartId: CartIdSchema.optional(),
  email: EmailSchema,
  shippingAddress: AddressSchema,
  /** Signed-in customers: keep this address in the address book. */
  saveAddress: z.boolean().optional(),
});

export type CheckoutResponse = {
  orderId: string;
  orderNumber: string;
  /** Guests use this to see their order; signed-in customers use their account. */
  accessToken: string;
  payment: PaymentSession;
  totals: Totals;
};

export type PaymentSession = {
  provider: 'STRIPE' | 'FAKE';
  clientSecret: string;
  /** Stripe publishable key for the Payment Element (null for the fake provider). */
  publishableKey: string | null;
  amountCents: number;
  currency: string;
};

export const OrderStatusSchema = z.enum([
  'PENDING_PAYMENT',
  'PAID',
  'FULFILLING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
]);
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

export type OrderItemView = {
  id: string;
  variantId: string | null;
  productTitle: string;
  variantTitle: string;
  sku: string;
  unitPriceCents: number;
  quantity: number;
  totalCents: number;
};

export type OrderView = {
  id: string;
  number: string;
  email: string;
  status: OrderStatus;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  couponCode: string | null;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  refundedCents: number;
  shippingAddress: z.infer<typeof AddressSchema>;
  items: OrderItemView[];
  tracking: { carrier: string; number: string; url: string | null } | null;
  /** Delivered within the return window and not fully returned yet. */
  returnableUntil: string | null;
  timeline: { status: OrderStatus; at: string }[];
  createdAt: string;
  placedAt: string | null;
};

export type OrderSummary = Pick<
  OrderView,
  'id' | 'number' | 'status' | 'totalCents' | 'currency' | 'createdAt' | 'placedAt'
> & { itemCount: number };

export const GuestOrderQuerySchema = z.object({ token: z.string().min(20).max(100) });

export const AdminOrderListQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: OrderStatusSchema.optional(),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const CARRIERS = ['UPS', 'USPS', 'FedEx', 'DHL'] as const;

export const OrderFulfillmentSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('start') }),
  z.object({
    action: z.literal('ship'),
    carrier: z.enum(CARRIERS),
    trackingNumber: z
      .string()
      .trim()
      .regex(/^[A-Za-z0-9-]{6,40}$/, { message: 'Enter the tracking number.' }),
  }),
  z.object({ action: z.literal('deliver') }),
  z.object({ action: z.literal('cancel'), reason: z.string().trim().min(3).max(300) }),
]);

export type Address = z.infer<typeof AddressSchema>;
export type UsState = (typeof US_STATES)[number];
export type AddressCreate = z.infer<typeof AddressCreateSchema>;
export type AddressUpdate = z.infer<typeof AddressUpdateSchema>;
export type SavedAddress = z.infer<typeof SavedAddressSchema>;
export type CartItemAdd = z.infer<typeof CartItemAddSchema>;
export type CartItemUpdate = z.infer<typeof CartItemUpdateSchema>;
export type CartMerge = z.infer<typeof CartMergeSchema>;
export type CheckoutRequest = z.infer<typeof CheckoutRequestSchema>;
export type GuestOrderQuery = z.infer<typeof GuestOrderQuerySchema>;
export type AdminOrderListQuery = z.infer<typeof AdminOrderListQuerySchema>;
export type OrderFulfillment = z.infer<typeof OrderFulfillmentSchema>;
