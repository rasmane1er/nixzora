'use server';

import { api } from '@/lib/api';
import { cents, checked, integer, OpsProblem, perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

function isoDate(value: string | undefined, endOfDay = false): string | null {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new OpsProblem('opsPeople:datesFormat');
  return new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}Z`).toISOString();
}

export async function createCoupon(form: FormData): Promise<void> {
  const t = await getT('opsPeople');
  await perform(
    '/coupons',
    () => {
      const type = text(form, 'type') === 'FIXED' ? 'FIXED' : 'PERCENT';
      const percent = Number(text(form, 'percent'));
      if (type === 'PERCENT' && !(percent > 0 && percent <= 90)) {
        throw new OpsProblem('opsPeople:percentRange');
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
          isPublic: checked(form, 'isPublic'),
        },
      });
    },
    t('couponCreated'),
  );
}

export async function setCouponActive(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const isActive = checked(form, 'isActive') || text(form, 'isActive') === 'true';
  const t = await getT('opsPeople');
  await perform(
    '/coupons',
    () => api(`/admin/coupons/${id}`, { method: 'PATCH', body: { isActive } }),
    isActive ? t('couponOn') : t('couponOff'),
  );
}

export async function setCouponPublic(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const isPublic = text(form, 'isPublic') === 'true';
  const t = await getT('opsPeople');
  await perform(
    '/coupons',
    () => api(`/admin/coupons/${id}`, { method: 'PATCH', body: { isPublic } }),
    isPublic ? t('couponListed') : t('couponHidden'),
  );
}
