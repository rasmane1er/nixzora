'use server';

import {
  type LoginResponse,
  type SocialProvider,
  type SocialProvidersResponse,
} from '@nixzora/validation';
import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { MFA_COOKIE, cookieOptions } from '@/lib/session';
import { finishSignIn, safeNext } from './sign-in';

const NONCE_COOKIE = 'nx_nonce';

/** Which sign-in buttons to show. Public and cached; empty when the API is unreachable. */
export async function socialProviders(): Promise<SocialProvidersResponse> {
  return api<SocialProvidersResponse>('/auth/social/providers', {
    auth: false,
    revalidate: 300,
  }).catch(() => ({ google: null, apple: null }));
}

/**
 * Starts a Google / Apple sign-in: a one-time nonce, kept in an HttpOnly cookie and placed in the
 * provider's ID token, so a token captured elsewhere cannot be replayed here.
 */
export async function startSocialSignIn(): Promise<string> {
  const nonce = randomBytes(24).toString('base64url');
  (await cookies()).set(NONCE_COOKIE, nonce, cookieOptions(10 * 60));
  return nonce;
}

export async function completeSocialSignIn(input: {
  provider: SocialProvider;
  idToken: string;
  next: string;
  firstName?: string;
  lastName?: string;
}): Promise<{ error: string } | void> {
  const next = safeNext(input.next);
  const jar = await cookies();
  const nonce = jar.get(NONCE_COOKIE)?.value;
  if (!nonce) return { error: (await getT('auth'))('socialExpired') };
  jar.delete(NONCE_COOKIE);

  let result: LoginResponse;
  try {
    result = await api<LoginResponse>('/auth/social', {
      method: 'POST',
      auth: false,
      body: {
        provider: input.provider,
        idToken: input.idToken,
        nonce,
        firstName: input.firstName?.slice(0, 100) || undefined,
        lastName: input.lastName?.slice(0, 100) || undefined,
        deviceName: 'NIXZORA web',
      },
    });
  } catch (error) {
    return { error: errorMessage(error) };
  }
  if ('mfaRequired' in result) {
    jar.set(MFA_COOKIE, result.mfaToken, cookieOptions(5 * 60));
    redirect(`/account/login/verify?next=${encodeURIComponent(next)}`);
  }
  await finishSignIn(result, next);
}
