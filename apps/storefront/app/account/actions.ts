'use server';

import {
  type AuthTokens,
  internationalNumber,
  type LoginResponse,
  type SignUpProblem,
  signUpProblems,
  type SignUpValues,
} from '@nixzora/validation';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getLocale, getT } from '@/lib/i18n';
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
  if (!mfaToken) {
    const t = await getT('auth');
    redirect(back('/account/login', t('signInExpired'), next));
  }
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

export type SignUpState = {
  error?: string;
  /** Problems found before sending (the form translates them). */
  problems?: Partial<Record<keyof SignUpValues, SignUpProblem>>;
  /** Messages the API sent back for a field. */
  fieldErrors?: Record<string, string>;
  /** What was typed (never the passwords), to fill the form again. */
  values?: Partial<
    Record<'firstName' | 'lastName' | 'email' | 'phoneCountry' | 'phone', string>
  > & {
    marketingEmails?: boolean;
  };
};

/** The sign-up form: checks the fields again on the server, then creates the account. */
export async function register(_: SignUpState, form: FormData): Promise<SignUpState> {
  const next = safeNext(form.get('next'));
  const text = (name: string) => String(form.get(name) ?? '');
  const values: SignUpValues = {
    firstName: text('firstName').trim(),
    lastName: text('lastName').trim(),
    email: text('email').trim(),
    phoneCountry: text('phoneCountry') || 'US',
    phone: text('phone').trim(),
    password: text('password'),
    confirmPassword: text('confirmPassword'),
    acceptTerms: form.get('acceptTerms') === 'on',
  };
  const marketingEmails = form.get('marketingEmails') === 'on';
  const kept: SignUpState['values'] = {
    firstName: values.firstName,
    lastName: values.lastName,
    email: values.email,
    phoneCountry: values.phoneCountry,
    phone: values.phone,
    marketingEmails,
  };
  const problems = signUpProblems(values);
  if (Object.keys(problems).length) {
    return { problems, values: kept, error: (await getT('auth'))('fixHighlighted') };
  }

  let tokens: AuthTokens;
  try {
    tokens = await api<AuthTokens>('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        email: values.email,
        password: values.password,
        firstName: values.firstName,
        lastName: values.lastName,
        phone: internationalNumber(values.phoneCountry, values.phone) ?? undefined,
        acceptTerms: true,
        marketingEmails,
        language: await getLocale(),
        deviceName: DEVICE,
      },
    });
  } catch (error) {
    const fieldErrors: Record<string, string> = {};
    if (error instanceof ApiError) {
      for (const issue of error.issues) fieldErrors[issue.field] = issue.message;
    }
    return { error: errorMessage(error), fieldErrors, values: kept };
  }
  // Refer a friend (p10-23): the invite this sign-up came from. A code that doesn't work any
  // more just doesn't apply; the account is made either way.
  const referral = String(form.get('referral') ?? '').toUpperCase();
  if (/^[A-Z0-9]{6,12}$/.test(referral)) {
    await api('/me/referral/claim', {
      method: 'POST',
      auth: false,
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      body: { code: referral },
    }).catch(() => undefined);
  }
  await finish(tokens, next);
  return {};
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
