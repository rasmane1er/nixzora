import { type ProductCard } from '@nixzora/validation';
import { cache } from 'react';
import { api } from './api';
import { isSignedIn } from './session';

/** Ids of the coupons this shopper has clipped (once per page render). */
export const clippedCouponIds = cache(async (): Promise<Set<string>> => {
  if (!(await isSignedIn())) return new Set();
  const ids = await api<string[]>('/me/coupons/clipped').catch((): string[] => []);
  return new Set(ids);
});

/** "Save 15% with coupon" / "Save $5.00 with coupon" for a card's coupon. */
export function couponLabel(
  coupon: NonNullable<ProductCard['coupon']>,
  t: (key: 'badgePercent' | 'badgeAmount', values: Record<string, string>) => string,
  f: { money: (cents: number) => string; percent: (fraction: number) => string },
): string {
  return coupon.kind === 'PERCENT'
    ? t('badgePercent', { percent: f.percent((coupon.percentOff ?? 0) / 100) })
    : t('badgeAmount', { amount: f.money(coupon.amountOffCents ?? 0) });
}
