'use server';

import {
  type AddressCreate,
  type Cart,
  type MfaEnabledResponse,
  type MfaSetupResponse,
} from '@nixzora/validation';
import { revalidatePath } from 'next/cache';
import QRCode from 'qrcode';
import { redirect } from 'next/navigation';
import { api, ApiError, errorMessage } from '@/lib/api';
import { clearSession } from '@/lib/session';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(form: FormData, name: string): string | undefined {
  const value = String(form.get(name) ?? '').trim();
  return value || undefined;
}

function to(path: string, kind: 'notice' | 'error', message: string): string {
  const [base, hash] = path.split('#');
  const url = new URL(base!, 'http://x');
  url.searchParams.set(kind, message);
  return `${url.pathname}${url.search}${hash ? `#${hash}` : ''}`;
}

/** Runs an account change, then returns to `path` with a notice or the API's error. */
async function perform(path: string, call: () => Promise<unknown>, notice: string) {
  try {
    await call();
  } catch (error) {
    if (error instanceof ApiError && error.status === 401) {
      redirect(`/account/login?next=${encodeURIComponent(path.split('#')[0]!)}`);
    }
    redirect(to(path, 'error', errorMessage(error)));
  }
  revalidatePath('/account', 'layout');
  redirect(to(path, 'notice', notice));
}

// ───── Profile and sign-in ─────

export async function updateProfile(form: FormData): Promise<void> {
  await perform(
    '/account/security',
    () =>
      api('/me/profile', {
        method: 'PATCH',
        body: {
          firstName: text(form, 'firstName') ?? null,
          lastName: text(form, 'lastName') ?? null,
          phone: text(form, 'phone') ?? null,
        },
      }),
    'Your name and phone number are saved.',
  );
}

export async function changePassword(form: FormData): Promise<void> {
  const next = String(form.get('newPassword') ?? '');
  if (next !== String(form.get('confirmPassword') ?? '')) {
    redirect(to('/account/security#password', 'error', 'The new passwords do not match.'));
  }
  await perform(
    '/account/security#password',
    () =>
      api('/auth/password/change', {
        method: 'POST',
        body: { currentPassword: String(form.get('currentPassword') ?? ''), newPassword: next },
      }),
    'Password changed. Other devices were signed out.',
  );
}

export async function resendVerification(): Promise<void> {
  await perform(
    '/account/security',
    () => api('/auth/email/verify/resend', { method: 'POST' }),
    'We sent a new confirmation link. Check your inbox.',
  );
}

export type MfaStep =
  | { step: 'idle'; error?: string }
  | { step: 'scan'; secret: string; qr: string; error?: string }
  | { step: 'codes'; recoveryCodes: string[] };

export async function startMfa(): Promise<MfaStep> {
  try {
    const setup = await api<MfaSetupResponse>('/me/mfa/setup', { method: 'POST' });
    // The QR code is drawn on the server: the secret never goes to a third-party service.
    const qr = await QRCode.toDataURL(setup.otpauthUrl, { margin: 1, width: 220 });
    return { step: 'scan', secret: setup.secret, qr };
  } catch (error) {
    return { step: 'idle', error: errorMessage(error) };
  }
}

export async function confirmMfa(setup: MfaStep, form: FormData): Promise<MfaStep> {
  if (setup.step !== 'scan') return setup;
  try {
    const result = await api<MfaEnabledResponse>('/me/mfa/enable', {
      method: 'POST',
      body: { code: String(form.get('code') ?? '') },
    });
    revalidatePath('/account', 'layout');
    return { step: 'codes', recoveryCodes: result.recoveryCodes };
  } catch (error) {
    return { ...setup, error: errorMessage(error) };
  }
}

export async function disableMfa(form: FormData): Promise<void> {
  await perform(
    '/account/security#two-step',
    () => api('/me/mfa/disable', { method: 'POST', body: { code: text(form, 'code') ?? '' } }),
    'Two-step verification is off.',
  );
}

export async function signOutDevice(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/account/security#devices');
  await perform(
    '/account/security#devices',
    () => api(`/me/sessions/${id}`, { method: 'DELETE' }),
    'That device is signed out.',
  );
}

export async function signOutOtherDevices(): Promise<void> {
  await perform(
    '/account/security#devices',
    () => api('/me/sessions', { method: 'DELETE' }),
    'Signed out everywhere except here.',
  );
}

// ───── Addresses ─────

function addressFrom(form: FormData): AddressCreate {
  return {
    label: text(form, 'label'),
    fullName: text(form, 'fullName') ?? '',
    line1: text(form, 'line1') ?? '',
    line2: text(form, 'line2'),
    city: text(form, 'city') ?? '',
    region: (text(form, 'region') ?? '') as AddressCreate['region'],
    postalCode: text(form, 'postalCode') ?? '',
    country: 'US',
    phone: text(form, 'phone'),
    isDefaultShipping: form.get('isDefaultShipping') === 'on',
  };
}

export async function saveAddress(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  const editing = UUID.test(id);
  await perform(
    editing ? `/account/addresses#a-${id}` : '/account/addresses',
    () =>
      api(editing ? `/me/addresses/${id}` : '/me/addresses', {
        method: editing ? 'PATCH' : 'POST',
        body: addressFrom(form),
      }),
    editing ? 'Address updated.' : 'Address added.',
  );
}

export async function makeDefaultAddress(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/account/addresses');
  await perform(
    '/account/addresses',
    () => api(`/me/addresses/${id}`, { method: 'PATCH', body: { isDefaultShipping: true } }),
    'Default address changed.',
  );
}

export async function removeAddress(form: FormData): Promise<void> {
  const id = String(form.get('id') ?? '');
  if (!UUID.test(id)) redirect('/account/addresses');
  await perform(
    '/account/addresses',
    () => api(`/me/addresses/${id}`, { method: 'DELETE' }),
    'Address removed.',
  );
}

// ───── Orders ─────

/** "Buy it again": adds the product to the cart and opens the cart. */
export async function buyAgain(form: FormData): Promise<void> {
  const variantId = String(form.get('variantId') ?? '');
  const back = String(form.get('back') ?? '/account/orders');
  const safeBack = back.startsWith('/account') ? back : '/account/orders';
  if (!UUID.test(variantId)) redirect(safeBack);
  try {
    await api<Cart>('/cart/items', {
      method: 'POST',
      cart: true,
      body: { variantId, quantity: 1 },
    });
  } catch (error) {
    redirect(to(safeBack, 'error', errorMessage(error)));
  }
  revalidatePath('/', 'layout');
  redirect('/cart?added=1');
}

// ───── Preferences and privacy ─────

export async function savePreferences(form: FormData): Promise<void> {
  await perform(
    '/account/preferences',
    () =>
      api('/me/preferences', {
        method: 'PUT',
        body: {
          marketingEmails: form.get('marketingEmails') === 'on',
          reviewRequests: form.get('reviewRequests') === 'on',
        },
      }),
    'Preferences saved.',
  );
}

export async function closeAccount(form: FormData): Promise<void> {
  if (form.get('understand') !== 'on') {
    redirect(to('/account/privacy#close', 'error', 'Tick the box to confirm you understand.'));
  }
  const password = text(form, 'password');
  const confirm = text(form, 'confirm');
  try {
    await api('/me', {
      method: 'DELETE',
      body: password ? { password } : { confirm: confirm === 'DELETE' ? 'DELETE' : undefined },
    });
  } catch (error) {
    redirect(to('/account/privacy#close', 'error', errorMessage(error)));
  }
  await clearSession();
  redirect('/?notice=Your+account+is+closed.');
}
