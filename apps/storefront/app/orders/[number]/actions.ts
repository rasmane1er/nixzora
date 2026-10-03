'use server';

import { revalidatePath } from 'next/cache';
import { api, errorMessage } from '@/lib/api';

export type ReturnState = { ok?: boolean; error?: string };

export async function requestReturn(_: ReturnState, form: FormData): Promise<ReturnState> {
  const number = String(form.get('number') ?? '');
  const token = String(form.get('token') ?? '');
  if (!/^NX-[A-Z0-9]{6}$/.test(number)) return { error: 'Unknown order.' };
  const items = form
    .getAll('item')
    .map(String)
    .filter((id) => /^[0-9a-f-]{36}$/i.test(id))
    .map((orderItemId) => ({ orderItemId, quantity: Number(form.get(`qty-${orderItemId}`) ?? 1) }));
  if (!items.length) return { error: 'Choose at least one item to return.' };
  try {
    await api(`/orders/${number}/returns${token ? `?token=${encodeURIComponent(token)}` : ''}`, {
      method: 'POST',
      body: {
        reason: String(form.get('reason') ?? 'OTHER'),
        note: String(form.get('note') ?? '').trim() || undefined,
        items,
      },
    });
    revalidatePath(`/orders/${number}`);
    return { ok: true };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export type RatingState = { ok?: boolean; error?: string };

export async function rateSeller(_: RatingState, form: FormData): Promise<RatingState> {
  const number = String(form.get('number') ?? '');
  const token = String(form.get('token') ?? '');
  if (!/^NX-[A-Z0-9]{6}$/.test(number)) return { error: 'Unknown order.' };
  const rating = Number(form.get('rating'));
  if (!(rating >= 1 && rating <= 5)) return { error: 'Choose 1 to 5 stars.' };
  try {
    await api(
      `/orders/${number}/seller-ratings${token ? `?token=${encodeURIComponent(token)}` : ''}`,
      {
        method: 'POST',
        body: {
          seller: String(form.get('seller') ?? ''),
          rating,
          comment: String(form.get('comment') ?? '').trim() || undefined,
        },
      },
    );
    revalidatePath(`/orders/${number}`);
    return { ok: true };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
