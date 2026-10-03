import { ApiError, createApiClient } from '@nixzora/api-client';
import type { AuthTokens, MeResponse } from '@nixzora/validation';
import { useSyncExternalStore } from 'react';
import { confirmIdentity } from './biometrics';
import { API_URL } from './config';
import { secureStorage } from './secure-storage';

export type SessionStatus = 'loading' | 'locked' | 'signedOut' | 'signedIn';
export type SessionState = {
  status: SessionStatus;
  user: MeResponse | null;
  /** Ask for Face ID / fingerprint before using the saved sign-in. */
  biometricLock: boolean;
};

const KEYS = {
  refresh: 'nixzora.refreshToken',
  cart: 'nixzora.guestCartId',
  biometric: 'nixzora.biometricLock',
} as const;

/** A client without session hooks: the session itself must never recurse into a refresh. */
const authApi = createApiClient({ baseUrl: API_URL, clientName: 'nixzora-mobile' });

let state: SessionState = { status: 'loading', user: null, biometricLock: false };
let accessToken: string | null = null;
let guestCartId: string | null = null;
let refreshing: Promise<string | null> | null = null;
const listeners = new Set<() => void>();

function set(patch: Partial<SessionState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

async function loadUser(token: string): Promise<MeResponse> {
  return authApi.request<MeResponse>('GET', '/auth/me', { token });
}

async function save(tokens: AuthTokens): Promise<void> {
  accessToken = tokens.accessToken;
  await secureStorage.set(KEYS.refresh, tokens.refreshToken);
}

async function forget(): Promise<void> {
  accessToken = null;
  await secureStorage.remove(KEYS.refresh);
}

/**
 * Rotates the refresh token. Only one rotation runs at a time: the API treats a second use of
 * the same refresh token as theft and ends the session.
 */
function refresh(): Promise<string | null> {
  refreshing ??= (async () => {
    const refreshToken = await secureStorage.get(KEYS.refresh);
    if (!refreshToken) return null;
    try {
      const tokens = await authApi.auth.refresh(refreshToken);
      await save(tokens);
      return tokens.accessToken;
    } catch (error) {
      // Offline: keep the saved sign-in and try again later.
      if (error instanceof ApiError && error.offline) return null;
      await forget();
      set({ status: 'signedOut', user: null });
      return null;
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export const session = {
  getState: (): SessionState => state,
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  accessToken: (): string | null => accessToken,
  refresh,

  cartId: (): string | null => guestCartId,
  setCartId(id: string | null): void {
    guestCartId = id;
    void (id ? secureStorage.set(KEYS.cart, id) : secureStorage.remove(KEYS.cart));
  },

  /** App start: restore the saved sign-in (after Face ID when the lock is on). */
  async boot(): Promise<void> {
    const [refreshToken, cart, lock] = await Promise.all([
      secureStorage.get(KEYS.refresh),
      secureStorage.get(KEYS.cart),
      secureStorage.get(KEYS.biometric),
    ]);
    guestCartId = cart;
    const biometricLock = lock === '1';
    if (!refreshToken) return set({ status: 'signedOut', biometricLock });
    set({ biometricLock });
    if (biometricLock) return set({ status: 'locked' });
    await session.resume();
  },

  async unlock(): Promise<boolean> {
    if (!(await confirmIdentity('Unlock NIXZORA'))) return false;
    await session.resume();
    return true;
  },

  async resume(): Promise<void> {
    const token = await refresh();
    if (!token) {
      // Offline with a saved sign-in: browse as a guest until the network is back.
      if (state.status !== 'signedOut') set({ status: 'signedOut', user: null });
      return;
    }
    try {
      set({ status: 'signedIn', user: await loadUser(token) });
    } catch {
      set({ status: 'signedOut', user: null });
    }
  },

  async signIn(tokens: AuthTokens): Promise<MeResponse> {
    await save(tokens);
    const user = await loadUser(tokens.accessToken);
    set({ status: 'signedIn', user });
    return user;
  },

  /**
   * Ends the session on the server too; local sign-out always succeeds. `serverEnded` skips the
   * server calls when the API already ended every session (account deleted).
   */
  async signOut(
    beforeLogout?: (token: string) => Promise<void>,
    serverEnded = false,
  ): Promise<void> {
    const token = accessToken;
    if (token && !serverEnded) {
      await beforeLogout?.(token).catch(() => undefined);
      await authApi.auth.logout(token).catch(() => undefined);
    }
    await forget();
    set({ status: 'signedOut', user: null });
  },

  /** Reloads the signed-in user (after a profile change), keeping the session as it is. */
  async refreshUser(): Promise<void> {
    if (state.status !== 'signedIn' || !accessToken) return;
    try {
      set({ user: await loadUser(accessToken) });
    } catch {
      // Keep the current details; the next app start reloads them.
    }
  },

  async setBiometricLock(enabled: boolean): Promise<boolean> {
    if (enabled && !(await confirmIdentity('Turn on Face ID / fingerprint unlock'))) return false;
    await (enabled ? secureStorage.set(KEYS.biometric, '1') : secureStorage.remove(KEYS.biometric));
    set({ biometricLock: enabled });
    return true;
  },
};

export function useSession(): SessionState {
  return useSyncExternalStore(session.subscribe, session.getState, session.getState);
}
