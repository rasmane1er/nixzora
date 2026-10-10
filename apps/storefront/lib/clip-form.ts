import { type ClipCouponCreate } from '@nixzora/validation';
import { localToIso } from './deal-form';

/** The coupon form's fields as the API expects them (the API validates the rest). */
export function clipFromForm(form: FormData): Partial<ClipCouponCreate> & { problem?: 'times' } {
  const offset = Number(form.get('tzOffset'));
  const tz = Number.isFinite(offset) && Math.abs(offset) <= 14 * 60 ? offset : 0;
  const startsRaw = String(form.get('startsAt') ?? '');
  const startsAt = startsRaw ? localToIso(startsRaw, tz) : null;
  const endsAt = localToIso(form.get('endsAt'), tz);
  const kind = form.get('kind') === 'AMOUNT' ? 'AMOUNT' : 'PERCENT';
  const value = Number(form.get('value'));
  const budget = String(form.get('maxRedemptions') ?? '').trim();
  return {
    productId: String(form.get('productId') ?? ''),
    kind,
    ...(kind === 'PERCENT'
      ? { percentOff: Math.round(value) }
      : { amountOffCents: Math.round(value * 100) }),
    startsAt,
    ...(endsAt ? { endsAt } : { problem: 'times' as const }),
    maxRedemptions: budget ? Number(budget) : null,
  };
}
