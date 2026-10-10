'use server';

import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { dealFromForm } from '@/lib/deal-form';
import { perform, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

const PAGE = '/deals';

export async function createDeal(form: FormData): Promise<void> {
  const t = await getT('deals');
  const { problem, ...body } = dealFromForm(form);
  if (problem) redirect(`${PAGE}?error=${encodeURIComponent(t('timesHint'))}`);
  await perform(PAGE, () => api('/admin/deals', { method: 'POST', body }), t('scheduled'));
}

export async function cancelDeal(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('deals');
  await perform(PAGE, () => api(`/admin/deals/${id}/cancel`, { method: 'POST' }), t('cancelled'));
}
