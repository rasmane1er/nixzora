import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import { session } from '@/lib/session';

const items = (SecureStore as unknown as { __items: Map<string, string> }).__items;
const tokens = (n: number) => ({
  accessToken: `access-${n}`,
  accessTokenExpiresIn: 900,
  refreshToken: `refresh-token-number-${n}-xxxxxxxxxxxx`,
  refreshTokenExpiresAt: '2027-01-01T00:00:00.000Z',
  sessionId: '01900000-0000-7000-8000-000000000000',
});
const me = {
  id: '01900000-0000-7000-8000-000000000001',
  email: 'ada@example.com',
  emailVerified: true,
  firstName: 'Ada',
  lastName: null,
  mfaEnabled: false,
  roles: ['customer'],
  permissions: [],
};
/** A minimal fetch Response (the test environment's Response polyfill drops the status). */
const json = (body: unknown, status = 200) =>
  Promise.resolve({ ok: status < 300, status, json: async () => body } as unknown as Response);

let fetchMock: jest.Mock;

beforeEach(() => {
  items.clear();
  fetchMock = jest.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

describe('session', () => {
  it('starts signed out when nothing is saved', async () => {
    await session.boot();
    expect(session.getState().status).toBe('signedOut');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('restores a saved sign-in by rotating the refresh token', async () => {
    items.set('nixzora.refreshToken', tokens(1).refreshToken);
    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/auth/refresh') ? json(tokens(2)) : json(me),
    );
    await session.boot();
    expect(session.getState()).toMatchObject({
      status: 'signedIn',
      user: { email: 'ada@example.com' },
    });
    expect(session.accessToken()).toBe('access-2');
    expect(items.get('nixzora.refreshToken')).toBe(tokens(2).refreshToken);
  });

  it('runs one rotation at a time, so the API never sees a refresh token twice', async () => {
    items.set('nixzora.refreshToken', tokens(1).refreshToken);
    fetchMock.mockImplementation(() => json(tokens(3)));
    const [a, b] = await Promise.all([session.refresh(), session.refresh()]);
    expect(a).toBe('access-3');
    expect(b).toBe('access-3');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('signs out when the refresh token is rejected, but not when offline', async () => {
    items.set('nixzora.refreshToken', tokens(1).refreshToken);
    fetchMock.mockImplementationOnce(() => Promise.reject(new TypeError('Network request failed')));
    expect(await session.refresh()).toBeNull();
    expect(items.has('nixzora.refreshToken')).toBe(true);

    fetchMock.mockImplementationOnce(() => json({ message: 'Session expired' }, 401));
    expect(await session.refresh()).toBeNull();
    expect(items.has('nixzora.refreshToken')).toBe(false);
    expect(session.getState().status).toBe('signedOut');
  });

  it('asks for biometrics before using a saved sign-in when the lock is on', async () => {
    items.set('nixzora.refreshToken', tokens(1).refreshToken);
    items.set('nixzora.biometricLock', '1');
    await session.boot();
    expect(session.getState().status).toBe('locked');

    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValueOnce({ success: false });
    expect(await session.unlock()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();

    fetchMock.mockImplementation((url: string) =>
      url.endsWith('/auth/refresh') ? json(tokens(4)) : json(me),
    );
    expect(await session.unlock()).toBe(true);
    expect(session.getState().status).toBe('signedIn');
  });

  it('signs out on the server and forgets the tokens', async () => {
    await session.signIn(tokens(5) as never).catch(() => undefined);
    fetchMock.mockImplementation(() => json(null, 204));
    const forget = jest.fn(async () => undefined);
    await session.signOut(forget);
    expect(forget).toHaveBeenCalledWith('access-5');
    expect(fetchMock.mock.calls.at(-1)![0]).toMatch(/\/auth\/logout$/);
    expect(items.has('nixzora.refreshToken')).toBe(false);
    expect(session.getState().status).toBe('signedOut');
  });
});
