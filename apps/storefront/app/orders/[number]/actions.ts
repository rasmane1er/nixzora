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
