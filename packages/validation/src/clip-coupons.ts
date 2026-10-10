import { z } from 'zod';
import { type ProductCard } from './catalog';

/**
 * Clip coupons (p10-18): "Save 15% with coupon" on one product. A signed-in shopper clips it
 * once; it then applies at checkout to that product, in one order. Stores make coupons for their
 * own listings and fund them; NIXZORA staff for NIXZORA's own.
 */
export const CLIP_PERCENT_MIN = 5;
export const CLIP_PERCENT_MAX = 50;
/** A coupon runs at most this long. */
export const CLIP_MAX_DAYS = 90;

export const ClipCouponCreateSchema = z
  .object({
    productId: z.uuid(),
    kind: z.enum(['PERCENT', 'AMOUNT']),
    percentOff: z.number().int().min(CLIP_PERCENT_MIN).max(CLIP_PERCENT_MAX).nullable().optional(),
    amountOffCents: z.number().int().min(100).max(50_000).nullable().optional(),
    /** Defaults to now. */
    startsAt: z.iso.datetime().nullable().optional(),
    endsAt: z.iso.datetime(),
    /** The budget: most orders that can use it. */
    maxRedemptions: z.number().int().min(1).max(100_000).nullable().optional(),
  })
  .refine((c) => (c.kind === 'PERCENT' ? c.percentOff != null : c.amountOffCents != null), {
    message: 'Give the percentage or the amount off.',
    path: ['kind'],
  })
  .refine((c) => Date.parse(c.endsAt) > Date.parse(c.startsAt ?? new Date().toISOString()), {
    message: 'The coupon must end after it starts.',
    path: ['endsAt'],
  })
  .refine(
    (c) =>
      Date.parse(c.endsAt) - Date.parse(c.startsAt ?? new Date().toISOString()) <=
      CLIP_MAX_DAYS * 86_400_000,
    { message: `A coupon runs up to ${CLIP_MAX_DAYS} days.`, path: ['endsAt'] },
  );
export type ClipCouponCreate = z.infer<typeof ClipCouponCreateSchema>;

/** What a product card says: "Save 15% with coupon" / "Save $5.00 with coupon". */
export type CardCoupon = {
  id: string;
  kind: 'PERCENT' | 'AMOUNT';
  percentOff: number | null;
  amountOffCents: number | null;
};

export type ClipCouponView = CardCoupon & {
  status: 'ACTIVE' | 'ENDED';
  startsAt: string;
  endsAt: string;
  maxRedemptions: number | null;
  redeemed: number;
  clips: number;
  product: ProductCard;
  seller: { handle: string; displayName: string } | null;
};

/** The coupons page: live coupons, and which the shopper has clipped (signed in). */
export type CouponsPage = { coupons: ClipCouponView[]; clipped: string[] };

/** A clipped coupon applied in the cart. */
export type CartCoupon = {
  id: string;
  productId: string;
  productTitle: string;
  discountCents: number;
};
