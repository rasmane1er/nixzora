'use server';

import { type MfaEnabledResponse, type MfaSetupResponse } from '@nixzora/validation';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { api, errorMessage } from '@/lib/api';
import { perform, text, uuidField, withMessage } from '@/lib/forms';
import { SETUP_COOKIE, cookieOptions } from '@/lib/session';

export async function startSetup(): Promise<void> {
  let setup: MfaSetupResponse;
  try {
    setup = await api<MfaSetupResponse>('/me/mfa/setup', { method: 'POST' });
  } catch (error) {
    redirect(withMessage('/security/setup', 'error', errorMessage(error)));
  }
  (await cookies()).set(SETUP_COOKIE, setup.otpauthUrl, {
    ...cookieOptions(10 * 60),
    path: '/security',
  });
  redirect('/security/setup');
}

export type EnableState = { error?: string; recoveryCodes?: string[] };

/** Returns the recovery codes to the page instead of redirecting: they are shown exactly once. */
export async function enableMfa(_: EnableState, form: FormData): Promise<EnableState> {
  try {
    const result = await api<MfaEnabledResponse>('/me/mfa/enable', {
      method: 'POST',
      body: { code: text(form, 'code') ?? '' },
    });
    // The setup cookie is left to expire on its own: changing cookies here would re-render
    // the page and hide the recovery codes before staff can save them.
    return { recoveryCodes: result.recoveryCodes };
  } catch (error) {
    return { error: errorMessage(error) };
  }
}

export async function revokeSession(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  await perform(
    '/security',
    () => api(`/me/sessions/${id}`, { method: 'DELETE' }),
    'Device signed out.',
  );
}

export async function revokeOthers(): Promise<void> {
  await perform(
    '/security',
    () => api('/me/sessions', { method: 'DELETE' }),
    'All other devices signed out.',
  );
}
