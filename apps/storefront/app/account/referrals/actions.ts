'use server';

import { ReferralClaimSchema } from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';

const PATH = '/account/referrals';

/** A new account enters a friend's invite code. */
export async function claimReferral(form: FormData): Promise<void> {
  const parsed = ReferralClaimSchema.safeParse({ code: form.get('code') });
  if (!parsed.success) {
    redirect(`${PATH}?error=${encodeURIComponent(parsed.error.issues[0]!.message)}`);
  }
  let message: string | null = null;
  try {
    await api('/me/referral/claim', { method: 'POST', body: parsed.data });
  } catch (error) {
    message = errorMessage(error);
  }
  revalidatePath(PATH);
  redirect(
    message
      ? `${PATH}?error=${encodeURIComponent(message)}`
      : `${PATH}?notice=${encodeURIComponent((await getT('referrals'))('claimed'))}`,
  );
}
