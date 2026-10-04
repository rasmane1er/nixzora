import { ApiError } from '@nixzora/api-client';
import { Platform } from 'react-native';
import { useSyncExternalStore } from 'react';
import { completeSignIn } from './account-actions';
import { api } from './api';
import { confirmIdentity } from './biometrics';
import { deviceName } from './device';
import { t } from './i18n';
import { secureStorage } from './secure-storage';

/**
 * "Sign in with Face ID / fingerprint" (ADR-0019). The API gives this phone a device secret,
 * kept in the Keychain / Keystore (this device only, never backed up). The app asks for Face ID
 * or the fingerprint before using it, and every sign-in swaps it for a new one. Signing out keeps
 * it, so the next sign-in needs no password; turning it off (here or on the website) ends it.
 */
type Saved = { id: string; secret: string; email: string };

const KEY = 'nixzora.deviceSignIn';
const OFFERED = 'nixzora.deviceSignInOffered';

let saved: Saved | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function publish(next: Saved | null): void {
  saved = next;
  loaded = true;
  for (const listener of listeners) listener();
}

async function load(): Promise<Saved | null> {
  if (loaded) return saved;
  try {
    const raw = await secureStorage.get(KEY);
    const value = raw ? (JSON.parse(raw) as Saved) : null;
    publish(value?.id && value.secret ? value : null);
  } catch {
    publish(null);
  }
  return saved;
}

async function store(value: Saved | null): Promise<void> {
  await (value ? secureStorage.set(KEY, JSON.stringify(value)) : secureStorage.remove(KEY));
  publish(value);
}

export const deviceSignIn = {
  load,

  /** The account this phone signs in to with Face ID / fingerprint, if it is on. */
  account: (): string | null => saved?.email ?? null,

  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Turns it on for the signed-in account (after Face ID / fingerprint). */
  async enable(email: string): Promise<boolean> {
    if (!(await confirmIdentity(t('appAccount')('bioSignInOnPrompt')))) return false;
    const previous = await load();
    const credential = await api.me.enableDeviceSignIn({
      deviceName: deviceName(),
      platform: Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web',
    });
    // Replacing another account's sign-in on this phone: end the old one if we still can.
    if (previous && previous.email !== email) {
      await api.me.revokeDeviceSignIn(previous.id).catch(() => undefined);
    }
    await store({ id: credential.id, secret: credential.secret, email });
    return true;
  },

  /** Turns it off: on the server when signed in, and always on this phone. */
  async disable(): Promise<void> {
    const current = await load();
    if (!current) return;
    await api.me.revokeDeviceSignIn(current.id).catch(() => undefined);
    await store(null);
  },

  /** Forget it on this phone only (account deleted, or the server no longer knows it). */
  forget: () => store(null),

  /**
   * Face ID / fingerprint, then a session. Returns false when the person cancelled. Throws the
   * API's error when the sign-in no longer works (the saved secret is then forgotten).
   */
  async signIn(): Promise<boolean> {
    const current = await load();
    if (!current) return false;
    if (!(await confirmIdentity(t('appAccount')('bioSignInPrompt')))) return false;
    try {
      const result = await api.auth.deviceSignIn({
        id: current.id,
        secret: current.secret,
        deviceName: deviceName(),
      });
      const { deviceSecret, ...tokens } = result;
      await store({ ...current, secret: deviceSecret });
      await completeSignIn(tokens);
      return true;
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) await store(null);
      throw error;
    }
  },

  /** Offer it once after a password sign-in, when the phone has Face ID / fingerprint. */
  async shouldOffer(email: string): Promise<boolean> {
    if ((await load())?.email === email) return false;
    return (await secureStorage.get(OFFERED).catch(() => null)) !== email;
  },
  markOffered: (email: string) => secureStorage.set(OFFERED, email).catch(() => undefined),
};

export function useDeviceSignInAccount(): string | null {
  return useSyncExternalStore(deviceSignIn.subscribe, deviceSignIn.account, deviceSignIn.account);
}
