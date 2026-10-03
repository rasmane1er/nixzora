'use server';

import { type AuthTokens, type LoginResponse } from '@nixzora/validation';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { back, finishSignIn as finish, safeNext } from './sign-in';
import { MFA_COOKIE, clearSession, cookieOptions } from '@/lib/session';

const DEVICE = 'NIXZORA web';

export async function signIn(form: FormData): Promise<void> {
  const next = safeNext(form.get('next'));
  let result: LoginResponse;
  try {
    result = await api<LoginResponse>('/auth/login', {
      method: 'POST',
      auth: false,
      body: {
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        deviceName: DEVICE,
      },
    });
  } catch (error) {
    redirect(back('/account/login', errorMessage(error), next));
  }
  if ('mfaRequired' in result) {
    (await cookies()).set(MFA_COOKIE, result.mfaToken, cookieOptions(5 * 60));
    redirect(`/account/login/verify?next=${encodeURIComponent(next)}`);
  }
  await finish(result, next);
}

export async function verifyCode(form: FormData): Promise<void> {
  const next = safeNext(form.get('next'));
  const mfaToken = (await cookies()).get(MFA_COOKIE)?.value;
  if (!mfaToken) redirect(back('/account/login', 'That sign-in expired. Start again.', next));
  let tokens: AuthTokens;
  try {
    tokens = await api<AuthTokens>('/auth/mfa/challenge', {
      method: 'POST',
      auth: false,
      body: { mfaToken, code: String(form.get('code') ?? '') },
    });
  } catch (error) {
    redirect(back('/account/login/verify', errorMessage(error), next));
  }
  await finish(tokens, next);
}

export async function register(form: FormData): Promise<void> {
  const next = safeNext(form.get('next'));
  let tokens: AuthTokens;
  try {
    tokens = await api<AuthTokens>('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        email: String(form.get('email') ?? ''),
        password: String(form.get('password') ?? ''),
        firstName: String(form.get('firstName') ?? '').trim() || undefined,
        deviceName: DEVICE,
      },
    });
  } catch (error) {
    redirect(back('/account/register', errorMessage(error), next));
  }
  await finish(tokens, next);
}

export async function signOut(): Promise<void> {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  await clearSession();
  redirect('/');
}

export async function forgotPassword(form: FormData): Promise<void> {
  try {
    await api('/auth/password/forgot', {
      method: 'POST',
      auth: false,
      body: { email: String(form.get('email') ?? '') },
    });
  } catch (error) {
    redirect(`/account/forgot-password?error=${encodeURIComponent(errorMessage(error))}`);
  }
  redirect('/account/forgot-password?sent=1');
}

export async function resetPassword(form: FormData): Promise<void> {
  const token = String(form.get('token') ?? '');
  try {
    await api('/auth/password/reset', {
      method: 'POST',
      auth: false,
      body: { token, newPassword: String(form.get('password') ?? '') },
    });
  } catch (error) {
    redirect(
      `/account/reset-password?token=${encodeURIComponent(token)}&error=${encodeURIComponent(errorMessage(error))}`,
    );
  }
  redirect('/account/login?reset=1');
}
