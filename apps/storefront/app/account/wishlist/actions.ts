'use server';

import { revalidatePath } from 'next/cache';
import { api, ApiError } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { accessToken } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type WishResult =
  { ok: true; saved: boolean } | { ok: false; signIn?: boolean; error?: string };

export async function setWish(productId: string, saved: boolean): Promise<WishResult> {
  if (!UUID.test(productId)) {
    return { ok: false, error: (await getT('accountActivity'))('wishUnknownProduct') };
  }
  if (!(await accessToken())) return { ok: false, signIn: true };
  try {
    await api(`/me/wishlist/${productId}`, { method: saved ? 'PUT' : 'DELETE' });
    revalidatePath('/account/wishlist');
    return { ok: true, saved };
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) return { ok: false, signIn: true };
    return { ok: false, error: (await getT('accountActivity'))('wishUpdateFailed') };
  }
}

export async function removeWish(form: FormData): Promise<void> {
  await setWish(String(form.get('productId') ?? ''), false);
}
