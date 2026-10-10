'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { dealFromForm } from '@/lib/deal-form';
import { getT } from '@/lib/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = '/sell/deals';

async function perform(call: () => Promise<unknown>, notice: 'scheduled' | 'cancelled') {
  const t = await getT('deals');
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

export async function createDeal(form: FormData): Promise<void> {
  const { problem, ...body } = dealFromForm(form);
  if (problem) {
    const t = await getT('deals');
    redirect(`${PAGE}?error=${encodeURIComponent(t('timesHint'))}`);
  }
  await perform(() => api('/seller/deals', { method: 'POST', body }), 'scheduled');
}

export async function cancelDeal(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  await perform(() => api(`/seller/deals/${id}/cancel`, { method: 'POST' }), 'cancelled');
}
