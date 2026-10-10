'use server';

import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { clipFromForm } from '@/lib/clip-form';
import { perform, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

const PAGE = '/clip-coupons';

export async function createClipCoupon(form: FormData): Promise<void> {
  const { problem, ...body } = clipFromForm(form);
  if (problem) redirect(`${PAGE}?error=${encodeURIComponent((await getT('deals'))('timesHint'))}`);
  const t = await getT('clips');
  await perform(PAGE, () => api('/admin/clip-coupons', { method: 'POST', body }), t('created'));
}

export async function endClipCoupon(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('clips');
  await perform(PAGE, () => api(`/admin/clip-coupons/${id}/end`, { method: 'POST' }), t('ended'));
}
