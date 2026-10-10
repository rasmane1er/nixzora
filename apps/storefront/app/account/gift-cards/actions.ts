'use server';

import { type GiftBalanceView } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { api, errorMessage } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';

export type RedeemState = { ok?: string; error?: string };

export async function redeemGiftCard(_: RedeemState, form: FormData): Promise<RedeemState> {
  const code = String(form.get('code') ?? '').trim();
  try {
    const before = await api<GiftBalanceView>('/me/gift-cards');
    const after = await api<GiftBalanceView>('/me/gift-cards/redeem', {
      method: 'POST',
      body: { code },
    });
    revalidatePath('/account/gift-cards');
    const [t, f] = await Promise.all([getT('gifts'), getFormat()]);
    return { ok: t('redeemed', { amount: f.money(after.balanceCents - before.balanceCents) }) };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}
