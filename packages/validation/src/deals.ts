import { z } from 'zod';
import { type ProductCard } from './catalog';

/**
 * Deals (p10-07): a limited-time percentage off every variant of one product. Lightning deals
 * run up to 12 hours and usually have a quantity ("64% claimed"); day deals run up to 7 days.
 * Stores create them for their own products; NIXZORA staff for any.
 */
export const DEAL_KINDS = ['LIGHTNING', 'DAY'] as const;
export type DealKind = (typeof DEAL_KINDS)[number];
export const DEAL_MAX_HOURS: Record<DealKind, number> = { LIGHTNING: 12, DAY: 7 * 24 };
export const DEAL_MIN_PERCENT = 5;
export const DEAL_MAX_PERCENT = 80;

export const DealCreateSchema = z
  .object({
    productId: z.uuid(),
    kind: z.enum(DEAL_KINDS),
    percentOff: z.number().int().min(DEAL_MIN_PERCENT).max(DEAL_MAX_PERCENT),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    quantity: z.number().int().min(1).max(100_000).nullable().optional(),
  })
  .refine((d) => Date.parse(d.endsAt) > Date.parse(d.startsAt), {
    message: 'The deal must end after it starts.',
    path: ['endsAt'],
  })
  .refine(
    (d) => Date.parse(d.endsAt) - Date.parse(d.startsAt) <= DEAL_MAX_HOURS[d.kind] * 3_600_000,
    { message: 'Lightning deals run up to 12 hours, day deals up to 7 days.', path: ['endsAt'] },
  );
export type DealCreate = z.infer<typeof DealCreateSchema>;

export type DealStatus = 'SCHEDULED' | 'LIVE' | 'ENDED' | 'CANCELLED';

export type DealView = {
  id: string;
  kind: DealKind;
  percentOff: number;
  startsAt: string;
  endsAt: string;
  quantity: number | null;
  claimed: number;
  status: DealStatus;
  product: { id: string; slug: string; title: string; imageUrl: string | null };
  seller: { handle: string; displayName: string } | null;
};

export const DealListQuerySchema = z.object({
  /** A department or category slug. */
  category: z.string().trim().max(80).optional(),
  kind: z.enum(DEAL_KINDS).optional(),
});
export type DealListQuery = z.infer<typeof DealListQuerySchema>;

/** The deals page: live deals, ending soonest first, and what starts next. */
export type DealsPage = {
  live: ProductCard[];
  upcoming: { product: ProductCard; startsAt: string; percentOff: number; kind: DealKind }[];
};
