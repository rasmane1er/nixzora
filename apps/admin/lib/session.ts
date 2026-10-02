import 'server-only';
import { cookies } from 'next/headers';
import { type AuthTokens } from '@nixzora/validation';

/**
 * Backend-for-frontend session. Tokens live in HttpOnly cookies on the Ops Center domain,
 * so browser JavaScript never sees them (ADR-0002). Only this server talks to the API.
 */
export const ACCESS_COOKIE = 'nx_at';
export const REFRESH_COOKIE = 'nx_rt';
export const MFA_COOKIE = 'nx_mfa';
/** Holds the otpauth URL only while staff scan it during setup (10 minutes, HttpOnly). */
export const SETUP_COOKIE = 'nx_mfa_setup';

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
