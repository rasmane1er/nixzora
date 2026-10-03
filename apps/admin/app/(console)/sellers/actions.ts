'use server';

import { api } from '@/lib/api';
import { integer, perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

export async function changeSellerStatus(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const status = text(form, 'status');
  const t = await getT('opsOrders');
  const labels: Record<string, string> = {
    ACTIVE: t('noticeStoreApproved'),
    SUSPENDED: t('noticeStoreSuspended'),
    REJECTED: t('noticeApplicationRejected'),
  };
  await perform(
    `/sellers/${id}`,
    () =>
      api(`/admin/sellers/${id}/status`, {
        method: 'POST',
        body: { status, reason: text(form, 'reason') },
      }),
    labels[status ?? ''] ?? t('noticeSaved'),
  );
}

export async function updateSellerTerms(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const percent = Number(text(form, 'commissionPercent'));
  const t = await getT('opsOrders');
  await perform(
    `/sellers/${id}`,
    () =>
      api(`/admin/sellers/${id}`, {
        method: 'PATCH',
        body: {
          commissionBps: Number.isFinite(percent) ? Math.round(percent * 100) : undefined,
          payoutHoldDays: integer(form, 'payoutHoldDays'),
        },
      }),
    t('noticeTermsSaved'),
  );
}

export async function refreshSellerPayouts(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsOrders');
  await perform(
    `/sellers/${id}`,
    () => api(`/admin/sellers/${id}/payouts/refresh`, { method: 'POST' }),
    t('noticePayoutRefreshed'),
  );
}

export async function reviewListing(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const decision = text(form, 'decision') === 'APPROVE' ? 'APPROVE' : 'REJECT';
  const t = await getT('opsOrders');
  await perform(
    text(form, 'back') ?? '/listings',
    () =>
      api(`/admin/listings/${id}/review`, {
        method: 'POST',
        body: { decision, note: text(form, 'note') },
      }),
    decision === 'APPROVE' ? t('noticeListingApproved') : t('noticeListingSentBack'),
  );
}

export async function payOutSeller(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('opsOrders');
  await perform(
    `/sellers/${id}`,
    () => api(`/admin/sellers/${id}/payouts`, { method: 'POST' }),
    t('noticePayoutSent'),
  );
}
