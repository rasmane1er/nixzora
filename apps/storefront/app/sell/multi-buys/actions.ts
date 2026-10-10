'use server';

import { MultiBuyCreateSchema } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = '/sell/multi-buys';

async function perform(call: () => Promise<unknown>, notice: 'created' | 'endedNotice') {
  const t = await getT('multiBuy');
  try {
    await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/account/login?next=${encodeURIComponent(PAGE)}`);
    }
    redirect(`${PAGE}?error=${encodeURIComponent(errorMessage(error))}`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?notice=${encodeURIComponent(t(notice))}`);
}

/** Starts a Buy X, get Y offer (p10-27) on the store's own listings. */
export async function createMultiBuy(form: FormData): Promise<void> {
  const days = String(form.get('days') ?? '');
  const parsed = MultiBuyCreateSchema.safeParse({
    buyQty: Number(form.get('buyQty')),
    getQty: Number(form.get('getQty')),
    percentOff: Number(form.get('percentOff')),
    productIds: form.getAll('productIds').map(String),
    days: days ? Number(days) : null,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const t = await getT('multiBuy');
    const message = issue?.path[0] === 'productIds' ? t('products') : (issue?.message ?? '');
    redirect(`${PAGE}?error=${encodeURIComponent(message)}`);
  }
  await perform(() => api('/seller/multi-buys', { method: 'POST', body: parsed.data }), 'created');
}

export async function endMultiBuy(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  await perform(() => api(`/seller/multi-buys/${id}/end`, { method: 'POST' }), 'endedNotice');
}
