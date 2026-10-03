import { z } from 'zod';
import { EmailSchema } from './auth';
import { US_STATES } from './commerce';
import { SellerHandleSchema } from './marketplace';

// ───────────── Seller onboarding (p8-13) ─────────────
// The application is filled in six steps and saved as a draft between them. Each step has its
// own schema (the web form validates one step at a time); the full application is all of them.

export const SELLER_ONBOARDING_STEPS = [
  { key: 'business', title: 'Business' },
  { key: 'owner', title: 'Owner' },
  { key: 'store', title: 'Store' },
  { key: 'shipping', title: 'Shipping & returns' },
  { key: 'payments', title: 'Payments & fees' },
  { key: 'review', title: 'Review' },
] as const;
export type SellerOnboardingStep = (typeof SELLER_ONBOARDING_STEPS)[number]['key'];

export const BUSINESS_TYPES = [
  'INDIVIDUAL',
  'LLC',
  'CORPORATION',
  'PARTNERSHIP',
  'NONPROFIT',
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];
export const BUSINESS_TYPE_LABEL: Record<BusinessType, string> = {
  INDIVIDUAL: 'Individual / sole proprietor',
  LLC: 'LLC',
  CORPORATION: 'Corporation',
  PARTNERSHIP: 'Partnership',
  NONPROFIT: 'Nonprofit',
};

/** What the store mainly sells: NIXZORA's departments. */
export const SELLER_CATEGORIES = [
  'computers',
  'monitors',
  'audio',
  'phones',
  'smart-home',
  'gaming',
  'accessories',
  'wearables',
  'other-electronics',
] as const;
export type SellerCategory = (typeof SELLER_CATEGORIES)[number];
export const SELLER_CATEGORY_LABEL: Record<SellerCategory, string> = {
  computers: 'Computers',
  monitors: 'Monitors',
  audio: 'Audio',
  phones: 'Phones',
  'smart-home': 'Smart home',
  gaming: 'Gaming',
  accessories: 'Accessories',
  wearables: 'Wearables',
  'other-electronics': 'Other electronics',
};

export const SELLER_CARRIERS = ['USPS', 'UPS', 'FEDEX', 'DHL', 'OTHER'] as const;
export type SellerCarrier = (typeof SELLER_CARRIERS)[number];
export const SELLER_CARRIER_LABEL: Record<SellerCarrier, string> = {
  USPS: 'USPS',
  UPS: 'UPS',
  FEDEX: 'FedEx',
  DHL: 'DHL',
  OTHER: 'Other',
};

/** Where the store ships. NIXZORA delivers to US addresses only for now. */
export const SHIP_REGIONS = ['US_CONTIGUOUS', 'ALASKA_HAWAII', 'US_TERRITORIES'] as const;
export type ShipRegion = (typeof SHIP_REGIONS)[number];
export const SHIP_REGION_LABEL: Record<ShipRegion, string> = {
  US_CONTIGUOUS: 'Contiguous United States',
  ALASKA_HAWAII: 'Alaska & Hawaii',
  US_TERRITORIES: 'US territories',
};

/** Business days between the order and the hand-off to the carrier. */
export const HANDLING_DAYS = [1, 2] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

const PhoneSchema = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s().-]{6,24}$/, { message: 'Enter a valid phone number.' });

export const BusinessAddressSchema = z.object({
  line1: z.string().trim().min(3, 'Enter the street address.').max(200),
  line2: optionalText(200),
  city: z.string().trim().min(2, 'Enter the city.').max(100),
  region: z.enum(US_STATES, { message: 'Choose a US state.' }),
  postalCode: z
    .string()
    .trim()
    .regex(/^\d{5}(-\d{4})?$/, { message: 'Enter a 5-digit ZIP code.' }),
  country: z.literal('US', { message: 'NIXZORA supports US businesses for now.' }),
});

/** Step 1. */
export const SellerBusinessStepSchema = z.object({
  businessType: z.enum(BUSINESS_TYPES, { message: 'Choose a business type.' }),
  legalName: z.string().trim().min(2, 'Enter the legal business name.').max(120),
  displayName: z.string().trim().min(2, 'Enter a store name.').max(60),
  /** Generated from the store name when left out. */
  handle: SellerHandleSchema.optional(),
  category: z.enum(SELLER_CATEGORIES, { message: 'Choose a category.' }),
  whatYouSell: z.string().trim().min(3, 'Tell us what you sell.').max(300),
  website: z
    .url({ message: 'Enter a full address, like https://example.com.' })
    .max(200)
    .optional()
    .or(z.literal('').transform(() => undefined)),
  address: BusinessAddressSchema,
});

const isAdult = (iso: string) => {
  const born = new Date(`${iso}T00:00:00Z`);
  const now = new Date();
  const eighteen = new Date(
    Date.UTC(now.getUTCFullYear() - 18, now.getUTCMonth(), now.getUTCDate()),
  );
  return born <= eighteen && born.getUTCFullYear() >= 1900;
};

/** Step 2: private, for verification; never shown on the store. */
export const SellerOwnerStepSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your legal first name.').max(80),
  lastName: z.string().trim().min(1, 'Enter your legal last name.').max(80),
  dateOfBirth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { message: 'Enter your date of birth.' })
    .refine(isAdult, { message: 'Sellers must be 18 or older.' }),
  phone: PhoneSchema,
  residenceCountry: z.literal('US', { message: 'NIXZORA supports US residents for now.' }),
});

/** Step 3: what shoppers see on the store page. */
export const SellerStoreStepSchema = z.object({
  description: z
    .string()
    .trim()
    .min(20, 'Describe your store in at least 20 characters.')
    .max(1000),
  /** Storage keys from the branding uploads. */
  logoKey: z.string().max(300).optional(),
  bannerKey: z.string().max(300).optional(),
  /** Private: where NIXZORA contacts the store. Defaults to the account email. */
  contactEmail: EmailSchema.optional().or(z.literal('').transform(() => undefined)),
  /** Public customer support contact. */
  supportEmail: EmailSchema.optional().or(z.literal('').transform(() => undefined)),
  supportPhone: PhoneSchema.optional().or(z.literal('').transform(() => undefined)),
});

/** Step 4. */
export const SellerShippingStepSchema = z.object({
  handlingDays: z.coerce
    .number()
    .int()
    .refine((d) => (HANDLING_DAYS as readonly number[]).includes(d), {
      message: 'Orders must ship within 1 or 2 business days.',
    }),
  carriers: z
    .array(z.enum(SELLER_CARRIERS))
    .min(1, 'Choose at least one carrier.')
    .transform((c) => [...new Set(c)]),
  shipRegions: z
    .array(z.enum(SHIP_REGIONS))
    .refine((r) => r.includes('US_CONTIGUOUS'), {
      message: 'Stores must ship to the contiguous United States.',
    })
    .transform((r) => [...new Set(r)]),
  acceptReturnPolicy: z.literal(true, {
    message: 'Agree to the Seller Return Policy to continue.',
  }),
});

/** Step 5: fees are read and understood; Stripe is connected after submitting. */
export const SellerPaymentsStepSchema = z.object({
  acknowledgeFees: z.literal(true, { message: 'Confirm that you have read the seller fees.' }),
});

/** Step 6. */
export const SellerAgreementsSchema = z.object({
  acceptAgreement: z.literal(true, { message: 'Agree to the Seller Agreement to submit.' }),
  acceptReturnPolicy: z.literal(true, { message: 'Agree to the Seller Return Policy to submit.' }),
  confirmAccurate: z.literal(true, { message: 'Confirm that the information is accurate.' }),
});

export const SELLER_STEP_SCHEMAS = {
  business: SellerBusinessStepSchema,
  owner: SellerOwnerStepSchema,
  store: SellerStoreStepSchema,
  shipping: SellerShippingStepSchema,
  payments: SellerPaymentsStepSchema,
  review: SellerAgreementsSchema,
} as const;

/** POST /seller/apply: every step. */
export const SellerApplicationSchema = SellerBusinessStepSchema.extend({
  owner: SellerOwnerStepSchema,
  ...SellerStoreStepSchema.shape,
  ...SellerShippingStepSchema.omit({ acceptReturnPolicy: true }).shape,
  ...SellerPaymentsStepSchema.shape,
  ...SellerAgreementsSchema.shape,
});

/**
 * PUT /seller/application: the draft, saved after each step and by "Save & continue later".
 * Steps are checked when they are completed; the draft itself only has a size limit.
 */
export const SellerApplicationDraftSchema = z.object({
  /** The step to come back to (1–6). */
  step: z.number().int().min(1).max(SELLER_ONBOARDING_STEPS.length),
  /** Steps completed so far, by key. */
  completed: z.array(z.enum(SELLER_ONBOARDING_STEPS.map((s) => s.key))).max(6),
  data: z
    .record(z.string(), z.unknown())
    .refine((d) => JSON.stringify(d).length <= 20_000, { message: 'The draft is too large.' }),
});

/** PATCH /seller/me: the store settings an owner can change after onboarding. */
export const SellerProfileUpdateSchema = z
  .object({
    displayName: z.string().trim().min(2).max(60),
    description: z.string().trim().max(1000).nullable(),
    contactEmail: EmailSchema,
    category: z.enum(SELLER_CATEGORIES),
    website: z.url().max(200).nullable(),
    supportEmail: EmailSchema.nullable(),
    supportPhone: PhoneSchema.nullable(),
    logoKey: z.string().max(300).nullable(),
    bannerKey: z.string().max(300).nullable(),
    handlingDays: SellerShippingStepSchema.shape.handlingDays,
    carriers: SellerShippingStepSchema.shape.carriers,
    shipRegions: SellerShippingStepSchema.shape.shipRegions,
  })
  .partial();

export const SellerBrandingUploadSchema = z.object({
  kind: z.enum(['logo', 'banner']),
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  sizeBytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024, 'Images can be up to 5 MB.'),
});

export type SellerApplication = z.infer<typeof SellerApplicationSchema>;
export type SellerApplicationDraft = z.infer<typeof SellerApplicationDraftSchema>;
export type SellerApplicationDraftView = SellerApplicationDraft & { updatedAt: string };
export type SellerBusinessStep = z.infer<typeof SellerBusinessStepSchema>;
export type SellerOwnerStep = z.infer<typeof SellerOwnerStepSchema>;
export type SellerStoreStep = z.infer<typeof SellerStoreStepSchema>;
export type SellerShippingStep = z.infer<typeof SellerShippingStepSchema>;
export type SellerBrandingUpload = z.infer<typeof SellerBrandingUploadSchema>;
export type SellerProfileUpdate = z.infer<typeof SellerProfileUpdateSchema>;

/** What a sale earns the store: commission on the item price only (ADR-0013). */
export function sellerProceeds(itemCents: number, shippingCents: number, commissionBps: number) {
  const commissionCents = Math.round((itemCents * commissionBps) / 10_000);
  return {
    commissionCents,
    proceedsCents: itemCents + shippingCents - commissionCents,
  };
}
