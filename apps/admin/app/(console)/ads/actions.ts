'use server';

import { api } from '@/lib/api';
import { cents, perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

const PAGE = '/ads';

export async function suspendCampaign(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('ads');
  await perform(
    PAGE,
    () =>
      api(`/admin/ads/campaigns/${id}/suspend`, {
        method: 'POST',
        body: { reason: text(form, 'reason') ?? '' },
      }),
    t('noticeSuspended'),
  );
}

export async function restoreCampaign(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('ads');
  await perform(
    PAGE,
    () => api(`/admin/ads/campaigns/${id}/restore`, { method: 'POST' }),
    t('noticeRestored'),
  );
}

export async function grantAdCredit(form: FormData): Promise<void> {
  const sellerId = uuidField(form, 'sellerId');
  const t = await getT('ads');
  await perform(
    PAGE,
    () =>
      api(`/admin/ads/sellers/${sellerId}/credit`, {
        method: 'POST',
        body: { amountCents: cents(form, 'amount'), note: text(form, 'note') ?? '' },
      }),
    t('noticeCredit'),
  );
}
