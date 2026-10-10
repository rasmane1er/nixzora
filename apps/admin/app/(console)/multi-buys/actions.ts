'use server';

import { MultiBuyCreateSchema } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { perform, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

const PAGE = '/multi-buys';

/** Buy X, get Y (p10-27): an offer on NIXZORA's own products. */
export async function createMultiBuy(form: FormData): Promise<void> {
  const t = await getT('multiBuy');
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
    const message = issue?.path[0] === 'productIds' ? t('products') : (issue?.message ?? '');
    redirect(`${PAGE}?error=${encodeURIComponent(message)}`);
  }
  await perform(
    PAGE,
    () => api('/admin/multi-buys', { method: 'POST', body: parsed.data }),
    t('created'),
  );
}

/** Staff can end any offer, a store's included. */
export async function endMultiBuy(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('multiBuy');
  await perform(
    PAGE,
    () => api(`/admin/multi-buys/${id}/end`, { method: 'POST' }),
    t('endedNotice'),
  );
}
