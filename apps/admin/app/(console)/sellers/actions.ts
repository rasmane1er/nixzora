'use server';

import { api } from '@/lib/api';
import { integer, perform, text, uuidField } from '@/lib/forms';

export async function changeSellerStatus(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const status = text(form, 'status');
  const labels: Record<string, string> = {
    ACTIVE: 'Store approved.',
    SUSPENDED: 'Store suspended. Its listings were taken off sale.',
    REJECTED: 'Application rejected.',
  };
  await perform(
    `/sellers/${id}`,
    () =>
      api(`/admin/sellers/${id}/status`, {
        method: 'POST',
        body: { status, reason: text(form, 'reason') },
      }),
    labels[status ?? ''] ?? 'Saved.',
  );
}

export async function updateSellerTerms(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const percent = Number(text(form, 'commissionPercent'));
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
    'Terms saved.',
  );
}

export async function refreshSellerPayouts(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    `/sellers/${id}`,
    () => api(`/admin/sellers/${id}/payouts/refresh`, { method: 'POST' }),
    'Payout status refreshed.',
  );
}

export async function reviewListing(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const decision = text(form, 'decision') === 'APPROVE' ? 'APPROVE' : 'REJECT';
  await perform(
    text(form, 'back') ?? '/listings',
    () =>
      api(`/admin/listings/${id}/review`, {
        method: 'POST',
        body: { decision, note: text(form, 'note') },
      }),
    decision === 'APPROVE' ? 'Listing approved and live.' : 'Sent back to the seller.',
  );
}

export async function payOutSeller(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    `/sellers/${id}`,
    () => api(`/admin/sellers/${id}/payouts`, { method: 'POST' }),
    'Payout sent.',
  );
}
