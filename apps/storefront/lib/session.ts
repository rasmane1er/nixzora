import 'server-only';
import { type AuthTokens } from '@nixzora/validation';
import { cookies } from 'next/headers';

/**
 * Backend-for-frontend session (ADR-0002): tokens and the guest cart id live in HttpOnly
 * cookies on the storefront's domain. Browser JavaScript never sees them.
 */
export const ACCESS_COOKIE = 'nx_at';
export const REFRESH_COOKIE = 'nx_rt';
export const MFA_COOKIE = 'nx_mfa';
export const CART_COOKIE = 'nx_cart';
/** Appearance chosen in Your Account → Settings: "light" or "dark"; absent = follow the system. */
export const THEME_COOKIE = 'nx_theme';

const secure = process.env.NODE_ENV === 'production';

export function cookieOptions(maxAgeSeconds: number) {
  return { httpOnly: true, secure, sameSite: 'lax' as const, path: '/', maxAge: maxAgeSeconds };
}

export async function saveTokens(tokens: AuthTokens): Promise<void> {
  const store = await cookies();
  store.set(ACCESS_COOKIE, tokens.accessToken, cookieOptions(tokens.accessTokenExpiresIn));
  const refreshSeconds = Math.floor((Date.parse(tokens.refreshTokenExpiresAt) - Date.now()) / 1000);
  store.set(REFRESH_COOKIE, tokens.refreshToken, cookieOptions(refreshSeconds));
  store.delete(MFA_COOKIE);
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  store.delete(MFA_COOKIE);
}

export async function accessToken(): Promise<string | undefined> {
  return (await cookies()).get(ACCESS_COOKIE)?.value;
}

export async function isSignedIn(): Promise<boolean> {
  const store = await cookies();
  return Boolean(store.get(ACCESS_COOKIE)?.value || store.get(REFRESH_COOKIE)?.value);
}

export async function guestCartId(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE)?.value;
}

export async function saveGuestCartId(id: string | null): Promise<void> {
  const store = await cookies();
  if (id) store.set(CART_COOKIE, id, cookieOptions(30 * 24 * 3600));
  else store.delete(CART_COOKIE);
}
