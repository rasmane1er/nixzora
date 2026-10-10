'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = '/account/payments';

async function perform(call: () => Promise<unknown>, notice: 'removed' | 'defaultChanged') {
  const t = await getT('wallet');
  try {
    await call();
  } catch (error) {
    redirect(`${PAGE}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?notice=${encodeURIComponent(t(notice))}`);
}

export async function removeCard(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  await perform(() => api(`/me/payment-cards/${id}`, { method: 'DELETE' }), 'removed');
}

export async function makeDefault(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  await perform(() => api(`/me/payment-cards/${id}/default`, { method: 'POST' }), 'defaultChanged');
}
