'use server';

import { dollarsToCents, SpendOfferCreateSchema } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { perform, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

const PAGE = '/spend-offers';

/** Spend more, save more (p10-31): tiers on NIXZORA's own range. Empty tier rows are skipped. */
export async function createSpendOffer(form: FormData): Promise<void> {
  const t = await getT('spendSave');
  const mins = form.getAll('minDollars').map(String);
  const offs = form.getAll('offDollars').map(String);
  const tiers = mins.flatMap((min, i) =>
    min.trim() || offs[i]?.trim()
      ? [{ minCents: dollarsToCents(min), offCents: dollarsToCents(offs[i]) }]
      : [],
  );
  if (tiers.some((tier) => Number.isNaN(tier.minCents) || Number.isNaN(tier.offCents))) {
    redirect(`${PAGE}?error=${encodeURIComponent(t('badAmounts'))}`);
  }
  const days = String(form.get('days') ?? '');
  const parsed = SpendOfferCreateSchema.safeParse({ tiers, days: days ? Number(days) : null });
  if (!parsed.success) {
    redirect(`${PAGE}?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? '')}`);
  }
  await perform(
    PAGE,
    () => api('/admin/spend-offers', { method: 'POST', body: parsed.data }),
    t('created'),
  );
}

/** Staff can end any store's offer. */
export async function endSpendOffer(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('spendSave');
  await perform(
    PAGE,
    () => api(`/admin/spend-offers/${id}/end`, { method: 'POST' }),
    t('endedNotice'),
  );
}
