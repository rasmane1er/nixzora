import 'server-only';

import { isLocale, LOCALE_COOKIE } from '@nixzora/i18n';
import { type AccountProfile, type AuthTokens } from '@nixzora/validation';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { getLocale } from '@/lib/i18n';
import { guestCartId, saveGuestCartId, saveTokens } from '@/lib/session';

/**
 * Where to go after signing in: only a path on this site. Rejects "//host" and "/\\host"
 * (other sites), and any whitespace or control character, because browsers drop tabs and
 * newlines from URLs: "/\t/evil.example" would become "//evil.example".
 */
export function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === 'string' ? value : '';
  return /^\/(?![/\\])[^\s\\\u0000-\u001f\u007f]*$/.test(next) && next.length <= 2000
    ? next
    : '/account';
}

export function back(path: string, message: string, next: string): string {
  const url = new URLSearchParams({ error: message });
  if (next !== '/account') url.set('next', next);
  return `${path}?${url.toString()}`;
}

/** Signed in: move anything the guest put in their cart into the account cart. */
export async function finishSignIn(
  tokens: AuthTokens,
  next: string,
  { newAccount = false }: { newAccount?: boolean } = {},
): Promise<never> {
  await saveTokens(tokens);
  await syncLanguage(tokens.accessToken, newAccount);
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

/**
 * One language everywhere: a language picked on this browser (or, for a new account, the one the
 * browser asks for) is saved on the account; otherwise the account's language applies here.
 */
async function syncLanguage(accessToken: string, newAccount: boolean): Promise<void> {
  const store = await cookies();
  const chosen = store.get(LOCALE_COOKIE)?.value;
  const auth = { Authorization: `Bearer ${accessToken}` };
  try {
    if (isLocale(chosen) || newAccount) {
      const language = isLocale(chosen) ? chosen : await getLocale();
      await api('/me/language', { method: 'PUT', auth: false, headers: auth, body: { language } });
      return;
    }
    const profile = await api<AccountProfile>('/me/profile', { auth: false, headers: auth });
    if (isLocale(profile.language) && profile.language !== 'en') {
      store.set(LOCALE_COOKIE, profile.language, {
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 365 * 24 * 3600,
      });
    }
  } catch {
    // The language is a convenience: never block signing in.
  }
}
