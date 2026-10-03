'use server';

import { type AuthTokens, type LoginResponse, type MeResponse } from '@nixzora/validation';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api } from '@/lib/api';
import { problemMessage, text, withMessage } from '@/lib/forms';
import { getT } from '@/lib/i18n';
import { MFA_COOKIE, clearSession, cookieOptions, saveTokens } from '@/lib/session';

const DEVICE = 'Ops Center';

/** Only staff with admin.access may hold an Ops Center session. */
async function finish(tokens: AuthTokens): Promise<never> {
  const me = await api<MeResponse>('/auth/me', {
    anonymous: true,
    headers: { Authorization: `Bearer ${tokens.accessToken}` },
  });
  if (!me.permissions.includes('admin.access')) {
    // Close the session we just opened: this account is not staff.
    await api('/auth/logout', {
      method: 'POST',
      anonymous: true,
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    }).catch(() => undefined);
    await clearSession();
    redirect('/login?denied=1');
  }
  await saveTokens(tokens);
  redirect(me.mfaEnabled ? '/' : '/security/setup');
}

export async function signIn(form: FormData): Promise<void> {
  let result: LoginResponse;
  try {
    result = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      anonymous: true,
      body: {
        email: text(form, 'email') ?? '',
        password: form.get('password') ?? '',
        deviceName: DEVICE,
      },
    });
  } catch (error) {
    redirect(withMessage('/login', 'error', await problemMessage(error)));
  }

  if ('mfaRequired' in result) {
    (await cookies()).set(MFA_COOKIE, result.mfaToken, cookieOptions(5 * 60));
    redirect('/login/verify');
  }
  await finish(result);
}

export async function verifyCode(form: FormData): Promise<void> {
  const store = await cookies();
  const mfaToken = store.get(MFA_COOKIE)?.value;
  if (!mfaToken) {
    const t = await getT('ops');
    redirect(withMessage('/login', 'error', t('signInExpired')));
  }

  let tokens: AuthTokens;
  try {
    tokens = await api<AuthTokens>('/auth/mfa/challenge', {
      method: 'POST',
      anonymous: true,
      body: { mfaToken, code: text(form, 'code') ?? '' },
    });
  } catch (error) {
    redirect(withMessage('/login/verify', 'error', await problemMessage(error)));
  }
  await finish(tokens);
}

export async function signOut(): Promise<void> {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  await clearSession();
  redirect('/login?signedOut=1');
}
