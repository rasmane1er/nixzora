import { z } from 'zod';

/** URL-safe identifier: lowercase letters, digits and single hyphens. */
export const SlugSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'Use lowercase letters, numbers and hyphens only.',
  });

const Cents = z.number().int().min(0).max(100_000_000);

export const ProductStatusSchema = z.enum(['DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'ARCHIVED']);

/** Specs such as {"ram_gb": 32, "screen_in": 14, "os": "Linux"}. Flat on purpose, so they can be filtered. */
export const AttributesSchema = z.record(
  z.string().regex(/^[a-z][a-z0-9_]{0,39}$/, { message: 'Attribute names use snake_case.' }),
  z.union([z.string().max(200), z.number(), z.boolean()]),
);

/** Variant options such as {"memory": "32GB", "color": "Graphite"}. */
export const OptionsSchema = z.record(z.string().min(1).max(40), z.string().min(1).max(80));

/** True when the last digit of a GTIN-8/12/13/14 matches its GS1 check digit. */
export function isValidGtin(code: string): boolean {
  if (!/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = [...code].map(Number);
  const check = digits.pop()!;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

/** The barcode on the box: EAN-8, UPC-A, EAN-13 or GTIN-14. */
export const BarcodeSchema = z
  .string()
  .trim()
  .refine(isValidGtin, { message: 'Enter a valid EAN or UPC barcode (8, 12, 13 or 14 digits).' });

/** What the app's scanner sends: a barcode, a SKU, or a product link from a QR code. */
export const ProductLookupQuerySchema = z.object({ code: z.string().trim().min(3).max(300) });

export type ProductLookup = { slug: string; variantId: string | null };

// ───────────── Admin requests ─────────────

export const CategoryCreateSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: SlugSchema.optional(),
  parentId: z.uuid().nullable().optional(),
  description: z.string().trim().max(2000).optional(),
  position: z.number().int().min(0).max(10_000).optional(),
  isActive: z.boolean().optional(),
});
export const CategoryUpdateSchema = CategoryCreateSchema.partial();

export const BrandCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: SlugSchema.optional(),
});
export const BrandUpdateSchema = BrandCreateSchema.partial();

export const VariantCreateSchema = z
  .object({
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9-]{2,63}$/, { message: 'SKUs use letters, numbers and hyphens.' }),
    title: z.string().trim().min(1).max(120),
    barcode: BarcodeSchema.nullable().optional(),
    options: OptionsSchema.default({}),
    priceCents: Cents,
    compareAtCents: Cents.nullable().optional(),
    weightGrams: z.number().int().min(0).max(1_000_000).nullable().optional(),
    isActive: z.boolean().optional(),
    /** Units on hand when the variant is created. */
    initialStock: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((v) => v.compareAtCents == null || v.compareAtCents > v.priceCents, {
    message: 'The "was" price must be higher than the price.',
    path: ['compareAtCents'],
  });

export const VariantUpdateSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    barcode: BarcodeSchema.nullable(),
    options: OptionsSchema,
    priceCents: Cents,
    compareAtCents: Cents.nullable(),
    weightGrams: z.number().int().min(0).max(1_000_000).nullable(),
    isActive: z.boolean(),
  })
  .partial();

export const ProductCreateSchema = z.object({
  title: z.string().trim().min(2).max(200),
  slug: SlugSchema.optional(),
  description: z.string().trim().min(1).max(20_000),
  status: ProductStatusSchema.default('DRAFT'),
  categoryId: z.uuid(),
  brandId: z.uuid().nullable().optional(),
  attributes: AttributesSchema.default({}),
  variants: z.array(VariantCreateSchema).min(1).max(100),
});

export const ProductUpdateSchema = z
  .object({
    title: z.string().trim().min(2).max(200),
    slug: SlugSchema,
    description: z.string().trim().min(1).max(20_000),
    status: ProductStatusSchema,
    categoryId: z.uuid(),
    brandId: z.uuid().nullable(),
    attributes: AttributesSchema,
  })
  .partial();

export const InventoryAdjustReasonSchema = z.enum([
  'RECEIVED',
  'CORRECTION',
  'DAMAGED',
  'RETURNED',
]);

/** "Low stock" in the Ops Center: this many units free to sell, or fewer. */
export const LOW_STOCK_THRESHOLD = 5;
/** Most rows one stock list returns. */
export const STOCK_LIST_LIMIT = 500;

/** One variant's stock, as the Ops Center lists it. */
export type StockRow = {
  variantId: string;
  sku: string;
  variantTitle: string;
  productId: string;
  productTitle: string;
  onHand: number;
  reserved: number;
  available: number;
};

export const InventoryAdjustSchema = z.object({
  delta: z
    .number()
    .int()
    .min(-1_000_000)
    .max(1_000_000)
    .refine((n) => n !== 0, { message: 'Enter a change other than zero.' }),
  reason: InventoryAdjustReasonSchema,
  note: z.string().trim().max(500).optional(),
});

export const ImageContentTypeSchema = z.enum([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

export const UploadRequestSchema = z.object({
  contentType: ImageContentTypeSchema,
  sizeBytes: z
    .number()
    .int()
    .min(1)
    .max(10 * 1024 * 1024, { message: 'Images can be up to 10 MB.' }),
});

/** Photos per product: enough for every angle, detail and in-use shot. */
export const MAX_PRODUCT_IMAGES = 15;

/** The product's photos in their new order; the first is the main photo. */
export const ProductImageOrderSchema = z.object({
  imageIds: z.array(z.uuid()).min(1).max(MAX_PRODUCT_IMAGES),
});
export type ProductImageOrder = z.infer<typeof ProductImageOrderSchema>;

export const ProductImageAttachSchema = z.object({
  storageKey: z.string().regex(/^products\/[a-z0-9/-]+\.(jpg|png|webp|avif)$/),
  alt: z.string().trim().min(1).max(200),
  position: z.number().int().min(0).max(100).optional(),
});

// ───────────── Public queries ─────────────

export const ProductSortSchema = z.enum(['relevance', 'price_asc', 'price_desc', 'newest']);

export const ProductListQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: SlugSchema.optional(),
  brand: SlugSchema.optional(),
  /** A marketplace seller's store handle. */
  seller: SlugSchema.optional(),
  minPrice: z.coerce.number().int().min(0).optional(),
  maxPrice: z.coerce.number().int().min(0).optional(),
  inStock: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  sort: ProductSortSchema.default('relevance'),
  page: z.coerce.number().int().min(1).max(500).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

export const AdminProductListQuerySchema = ProductListQuerySchema.extend({
  status: ProductStatusSchema.optional(),
});

// ───────────── Responses ─────────────

export const ImageSchema = z.object({
  id: z.uuid(),
  url: z.string(),
  alt: z.string(),
  position: z.number().int(),
});

export const ProductCardSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  title: z.string(),
  brand: z.object({ slug: z.string(), name: z.string() }).nullable(),
  category: z.object({ slug: z.string(), name: z.string() }),
  priceFromCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  currency: z.string(),
  inStock: z.boolean(),
  image: ImageSchema.nullable(),
  /** Approved reviews; present on lists and detail pages. */
  rating: z.object({ average: z.number().nullable(), count: z.number().int() }).optional(),
  /** Set when the product has a single option, so a card can add it to the cart directly. */
  defaultVariantId: z.uuid().nullable().optional(),
});

export const VariantSchema = z.object({
  id: z.uuid(),
  sku: z.string(),
  barcode: z.string().nullable(),
  title: z.string(),
  options: z.record(z.string(), z.string()),
  priceCents: z.number().int(),
  compareAtCents: z.number().int().nullable(),
  currency: z.string(),
  available: z.number().int(),
  isActive: z.boolean(),
});

export const ProductDetailSchema = ProductCardSchema.extend({
  rating: z
    .object({ average: z.number().nullable(), count: z.number().int() })
    .default({ average: null, count: 0 }),
  description: z.string(),
  status: ProductStatusSchema,
  attributes: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  breadcrumb: z.array(z.object({ slug: z.string(), name: z.string() })),
  /** The marketplace seller; null when NIXZORA sells it. */
  seller: z
    .object({
      handle: z.string(),
      displayName: z.string(),
      rating: z
        .object({ average: z.number().nullable(), count: z.number().int() })
        .default({ average: null, count: 0 }),
    })
    .nullable()
    .default(null),
  /** Staff feedback on a seller's listing (only on staff and seller views). */
  reviewNote: z.string().nullable().default(null),
  images: z.array(ImageSchema),
  variants: z.array(VariantSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export type CategoryNode = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  position: number;
  isActive: boolean;
  productCount: number;
  children: CategoryNode[];
};

/** An uploaded image to check and prepare before it is shown (a preview before saving). */
export const UploadReadySchema = z.object({
  storageKey: z.string().regex(/^products\/[a-z0-9/-]+\.(jpg|png|webp|avif)$/),
});

export const UploadTicketSchema = z.object({
  storageKey: z.string(),
  uploadUrl: z.string(),
  method: z.literal('PUT'),
  headers: z.record(z.string(), z.string()),
  expiresAt: z.iso.datetime(),
  publicUrl: z.string(),
});

export type CategoryCreate = z.infer<typeof CategoryCreateSchema>;
export type CategoryUpdate = z.infer<typeof CategoryUpdateSchema>;
export type BrandCreate = z.infer<typeof BrandCreateSchema>;
export type BrandUpdate = z.infer<typeof BrandUpdateSchema>;
export type VariantCreate = z.infer<typeof VariantCreateSchema>;
export type VariantUpdate = z.infer<typeof VariantUpdateSchema>;
export type ProductCreate = z.infer<typeof ProductCreateSchema>;
export type ProductUpdate = z.infer<typeof ProductUpdateSchema>;
export type InventoryAdjust = z.infer<typeof InventoryAdjustSchema>;
export type UploadRequest = z.infer<typeof UploadRequestSchema>;
export type ProductImageAttach = z.infer<typeof ProductImageAttachSchema>;
export type ProductListQuery = z.infer<typeof ProductListQuerySchema>;
export type AdminProductListQuery = z.infer<typeof AdminProductListQuerySchema>;
export type ProductCard = z.infer<typeof ProductCardSchema>;
export type ProductDetail = z.infer<typeof ProductDetailSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type ProductLookupQuery = z.infer<typeof ProductLookupQuerySchema>;
export type Image = z.infer<typeof ImageSchema>;
export type UploadTicket = z.infer<typeof UploadTicketSchema>;
export type UploadReady = z.infer<typeof UploadReadySchema>;
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

export type PagedResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

/** Pages needed for `total` results; an empty list still has one page. */
export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

/** One page of `total` results. */
export function pagedResult<T>(
  items: T[],
  total: number,
  { page, pageSize }: { page: number; pageSize: number },
): PagedResult<T> {
  return { items, page, pageSize, total, totalPages: totalPages(total, pageSize) };
}

/** "Kestrel 14 Pro (2027)!" → "kestrel-14-pro-2027" */
export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/["'’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

/** Demo-catalog artwork for each department tile on the home pages (web and app). */
const DEPARTMENT_ART: Record<string, string> = {
  computers: 'vela-15-studio',
  laptops: 'vela-13-air',
  desktops: 'kestrel-tower-x',
  monitors: 'arden-27-4k-usb-c',
  audio: 'halo-anc-headphones',
  headphones: 'halo-anc-headphones',
  speakers: 'lumen-desk-speakers',
  phones: 'orbit-phone-256',
  'smart-home': 'nimbus-smart-hub',
  gaming: 'pulse-controller',
  accessories: 'tactile-75',
  keyboards: 'tactile-75',
  mice: 'tactile-precision-mouse',
  wearables: 'pulse-s-watch',
};

/** "/demo-products/vela-15-studio.webp" for a department slug (served by the storefront). */
export function departmentArtPath(slug: string): string | null {
  const name = DEPARTMENT_ART[slug];
  return name ? `/demo-products/${name}.webp` : null;
}
