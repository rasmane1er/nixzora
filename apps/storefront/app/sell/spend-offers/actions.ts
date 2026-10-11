'use server';

import { dollarsToCents, SpendOfferCreateSchema } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = '/sell/spend-offers';

async function perform(call: () => Promise<unknown>, notice: 'created' | 'endedNotice') {
  const t = await getT('spendSave');
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

/** Starts the store's Spend more, save more offer (p10-31). Empty tier rows are skipped. */
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
    () => api('/seller/spend-offers', { method: 'POST', body: parsed.data }),
    'created',
  );
}

export async function endSpendOffer(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) return;
  await perform(() => api(`/seller/spend-offers/${id}/end`, { method: 'POST' }), 'endedNotice');
}
