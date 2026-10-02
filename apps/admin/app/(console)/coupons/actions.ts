'use server';

import { api, FormProblem } from '@/lib/api';
import { cents, checked, integer, perform, text, uuidField } from '@/lib/forms';

function isoDate(value: string | undefined, endOfDay = false): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new FormProblem('Dates look like 2027-03-31.');
  return new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}Z`).toISOString();
}

export async function createCoupon(form: FormData): Promise<void> {
  await perform(
    '/coupons',
    () => {
      const type = text(form, 'type') === 'FIXED' ? 'FIXED' : 'PERCENT';
      const percent = Number(text(form, 'percent'));
      if (type === 'PERCENT' && !(percent > 0 && percent <= 90)) {
        throw new FormProblem('Enter a percentage between 1 and 90.');
      }
      return api('/admin/coupons', {
        method: 'POST',
        body: {
          code: text(form, 'code'),
          description: text(form, 'description'),
          type,
          value: type === 'PERCENT' ? Math.round(percent * 100) : cents(form, 'amount'),
          minSubtotalCents: cents(form, 'minSubtotal') ?? 0,
          maxRedemptions: integer(form, 'maxRedemptions') ?? null,
          startsAt: isoDate(text(form, 'startsAt')),
          endsAt: isoDate(text(form, 'endsAt'), true),
          isActive: true,
        },
      });
    },
    'Coupon created.',
  );
}

export async function setCouponActive(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const isActive = checked(form, 'isActive') || text(form, 'isActive') === 'true';
  await perform(
    '/coupons',
    () => api(`/admin/coupons/${id}`, { method: 'PATCH', body: { isActive } }),
    isActive ? 'Coupon turned on.' : 'Coupon turned off.',
  );
}
