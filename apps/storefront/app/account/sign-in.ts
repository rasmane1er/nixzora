import 'server-only';

import { type AuthTokens } from '@nixzora/validation';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { guestCartId, saveGuestCartId, saveTokens } from '@/lib/session';

/** Only same-site paths: "/checkout" yes, "//evil.com" or "https://…" no. */
export function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\')
    ? next
    : '/account';
}

export function back(path: string, message: string, next: string): string {
  const url = new URLSearchParams({ error: message });
  if (next !== '/account') url.set('next', next);
  return `${path}?${url.toString()}`;
}

/** Signed in: move anything the guest put in their cart into the account cart. */
export async function finishSignIn(tokens: AuthTokens, next: string): Promise<never> {
  await saveTokens(tokens);
  const guest = await guestCartId();
  if (guest) {
    await api('/cart/merge', {
      method: 'POST',
      auth: false,
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      body: { guestCartId: guest },
    }).catch(() => undefined);
    await saveGuestCartId(null);
  }
  redirect(next);
}
