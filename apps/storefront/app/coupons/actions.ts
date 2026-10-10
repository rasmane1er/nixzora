'use server';

import { revalidatePath } from 'next/cache';
import { api, errorMessage } from '@/lib/api';
import { accessToken } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ClipResult = { ok: true } | { ok: false; error: string; signIn?: boolean };

/** Clip coupons (p10-18): clip or remove one; the cart applies clipped coupons. */
export async function setClipped(couponId: string, clipped: boolean): Promise<ClipResult> {
  if (!UUID.test(couponId)) return { ok: false, error: 'Unknown coupon.' };
  if (!(await accessToken())) return { ok: false, error: '', signIn: true };
  try {
    await api(`/me/coupons/${couponId}/clip`, { method: clipped ? 'POST' : 'DELETE' });
  } catch (error) {
    return { ok: false, error: errorMessage(error) };
  }
  revalidatePath('/', 'layout');
  return { ok: true };
}
