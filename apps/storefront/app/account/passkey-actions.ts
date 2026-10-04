'use server';

import {
  type AuthTokens,
  type PasskeyOptionsResponse,
  type WebAuthnCredentialJson,
} from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { finishSignIn, safeNext } from './sign-in';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Result<T> = { ok: true; value: T } | { ok: false; error: string; signIn?: boolean };

async function attempt<T>(call: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await call() };
  } catch (error) {
    return {
      ok: false,
      error: errorMessage(error),
      signIn: error instanceof ApiError && error.status === 401,
    };
  }
}

// ───── Signing in ─────

/** A fresh challenge for navigator.credentials.get (no email needed). */
export async function passkeySignInOptions(): Promise<Result<PasskeyOptionsResponse>> {
  return attempt(() =>
    api<PasskeyOptionsResponse>('/auth/passkey/options', { method: 'POST', auth: false }),
  );
}

export async function completePasskeySignIn(input: {
  challengeToken: string;
  credential: WebAuthnCredentialJson;
  next: string;
}): Promise<{ error: string } | void> {
  const next = safeNext(input.next);
  const result = await attempt(() =>
    api<AuthTokens>('/auth/passkey', {
      method: 'POST',
      auth: false,
      body: {
        challengeToken: input.challengeToken,
        credential: input.credential,
        deviceName: 'NIXZORA web',
      },
    }),
  );
  if (!result.ok) return { error: result.error };
  await finishSignIn(result.value, next);
}

// ───── Managing passkeys (account → Security) ─────

export async function passkeyRegistrationOptions(): Promise<Result<PasskeyOptionsResponse>> {
  return attempt(() => api<PasskeyOptionsResponse>('/me/passkeys/options', { method: 'POST' }));
}

export async function savePasskey(input: {
  challengeToken: string;
  credential: WebAuthnCredentialJson;
}): Promise<{ error: string; signIn?: boolean } | { ok: true }> {
  const result = await attempt(() =>
    api('/me/passkeys', {
      method: 'POST',
      body: { challengeToken: input.challengeToken, credential: input.credential },
    }),
  );
  if (!result.ok) return { error: result.error, signIn: result.signIn };
  revalidatePath('/account/security');
  return { ok: true };
}

async function change(path: string, notice: string, method = 'DELETE'): Promise<never> {
  try {
    await api(path, { method });
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect('/account/login?next=/account/security');
    }
    redirect(`/account/security?error=${encodeURIComponent(errorMessage(error))}#passkeys`);
  }
  revalidatePath('/account/security');
  redirect(`/account/security?notice=${encodeURIComponent(notice)}#passkeys`);
}

export async function removePasskey(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/account/security#passkeys');
  await change(`/me/passkeys/${id}`, (await getT('account'))('passkeyRemoved'));
}

export async function revokeDeviceSignIn(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/account/security#passkeys');
  await change(`/me/device-sign-ins/${id}`, (await getT('account'))('appSignInRevoked'));
}
