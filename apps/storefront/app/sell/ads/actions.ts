'use server';

import { type MessageKey } from '@nixzora/i18n';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = '/sell/ads';

class Problem extends Error {
  constructor(readonly key: MessageKey<'ads'>) {
    super(key);
  }
}

function text(form: FormData, name: string): string | undefined {
  const value = form.get(name);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** "5", "0.5" or "$1.25" → cents; refuses anything else. */
function dollars(form: FormData, name: string): number | undefined {
  const raw = text(form, name)?.replace(/[$,\s]/g, '');
  if (raw === undefined) return undefined;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Problem('errorAmount');
  return Math.round(Number(raw) * 100);
}

function products(form: FormData): string[] {
  const ids = form.getAll('productIds').filter((v): v is string => typeof v === 'string');
  const valid = ids.filter((v) => UUID.test(v));
  if (!valid.length) throw new Problem('errorChooseProducts');
  return valid;
}

function campaignId(form: FormData): string {
  const id = text(form, 'id') ?? '';
  if (!UUID.test(id)) throw new Error('Invalid id');
  return id;
}

async function perform(call: () => Promise<unknown>, notice: MessageKey<'ads'>): Promise<void> {
  const t = await getT('ads');
  let message: string;
  try {
    await call();
    message = t(notice);
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/account/login?next=${encodeURIComponent(PAGE)}`);
    }
    const text = error instanceof Problem ? t(error.key) : errorMessage(error);
    redirect(`${PAGE}?error=${encodeURIComponent(text)}`);
  }
  revalidatePath(PAGE);
  redirect(`${PAGE}?notice=${encodeURIComponent(message)}`);
}

export async function createCampaign(form: FormData): Promise<void> {
  await perform(
    () =>
      api('/seller/ads/campaigns', {
        method: 'POST',
        body: {
          name: text(form, 'name') ?? '',
          productIds: products(form),
          dailyBudgetCents: dollars(form, 'dailyBudget'),
          bidCents: dollars(form, 'bid'),
          endsOn: text(form, 'endsOn') ?? null,
        },
      }),
    'noticeCreated',
  );
}

export async function updateCampaign(form: FormData): Promise<void> {
  await perform(
    () =>
      api(`/seller/ads/campaigns/${campaignId(form)}`, {
        method: 'PATCH',
        body: {
          name: text(form, 'name'),
          productIds: products(form),
          dailyBudgetCents: dollars(form, 'dailyBudget'),
          bidCents: dollars(form, 'bid'),
          endsOn: text(form, 'endsOn') ?? null,
        },
      }),
    'noticeSaved',
  );
}

export async function setCampaignStatus(form: FormData): Promise<void> {
  const status = text(form, 'status') === 'ACTIVE' ? 'ACTIVE' : 'PAUSED';
  await perform(
    () =>
      api(`/seller/ads/campaigns/${campaignId(form)}`, {
        method: 'PATCH',
        body: { status },
      }),
    status === 'ACTIVE' ? 'noticeResumed' : 'noticePaused',
  );
}
