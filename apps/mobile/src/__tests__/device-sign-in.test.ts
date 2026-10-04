import { ApiError } from '@nixzora/api-client';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { completeSignIn } from '@/lib/account-actions';
import { api } from '@/lib/api';
import { deviceSignIn } from '@/lib/device-sign-in';

jest.mock('@/lib/api', () => ({
  api: {
    me: { enableDeviceSignIn: jest.fn(), revokeDeviceSignIn: jest.fn() },
    auth: { deviceSignIn: jest.fn() },
  },
}));
jest.mock('@/lib/account-actions', () => ({ completeSignIn: jest.fn() }));

const items = (SecureStore as unknown as { __items: Map<string, string> }).__items;
const mocked = api as unknown as {
  me: { enableDeviceSignIn: jest.Mock; revokeDeviceSignIn: jest.Mock };
  auth: { deviceSignIn: jest.Mock };
};
const ID = '01900000-0000-7000-8000-0000000000d1';
const tokens = {
  accessToken: 'access',
  accessTokenExpiresIn: 900,
  refreshToken: 'refresh',
  refreshTokenExpiresAt: '2027-01-01T00:00:00.000Z',
  sessionId: '01900000-0000-7000-8000-000000000000',
};
const saved = () => JSON.parse(items.get('nixzora.deviceSignIn') ?? 'null');

beforeEach(async () => {
  jest.clearAllMocks();
  (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: true });
  await deviceSignIn.forget();
  items.clear();
});

describe('Face ID / fingerprint sign-in', () => {
  it('turns on after the biometric check and keeps the secret in secure storage', async () => {
    mocked.me.enableDeviceSignIn.mockResolvedValue({ id: ID, secret: 's1' });
    expect(await deviceSignIn.enable('ada@example.com')).toBe(true);
    expect(mocked.me.enableDeviceSignIn).toHaveBeenCalledWith(
      expect.objectContaining({ platform: 'ios' }),
    );
    expect(saved()).toEqual({ id: ID, secret: 's1', email: 'ada@example.com' });
    expect(deviceSignIn.account()).toBe('ada@example.com');
  });

  it('stays off when the biometric check is cancelled', async () => {
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });
    expect(await deviceSignIn.enable('ada@example.com')).toBe(false);
    expect(mocked.me.enableDeviceSignIn).not.toHaveBeenCalled();
    expect(deviceSignIn.account()).toBeNull();
  });

  it('signs in with the saved secret and keeps the rotated one', async () => {
    mocked.me.enableDeviceSignIn.mockResolvedValue({ id: ID, secret: 's1' });
    await deviceSignIn.enable('ada@example.com');
    mocked.auth.deviceSignIn.mockResolvedValue({ ...tokens, deviceSecret: 's2' });

    expect(await deviceSignIn.signIn()).toBe(true);
    expect(mocked.auth.deviceSignIn).toHaveBeenCalledWith(
      expect.objectContaining({ id: ID, secret: 's1' }),
    );
    expect(completeSignIn).toHaveBeenCalledWith(tokens);
    expect(saved().secret).toBe('s2');
  });

  it('does nothing without the biometric check', async () => {
    mocked.me.enableDeviceSignIn.mockResolvedValue({ id: ID, secret: 's1' });
    await deviceSignIn.enable('ada@example.com');
    (LocalAuthentication.authenticateAsync as jest.Mock).mockResolvedValue({ success: false });
    expect(await deviceSignIn.signIn()).toBe(false);
    expect(mocked.auth.deviceSignIn).not.toHaveBeenCalled();
  });

  it('forgets a sign-in the server turned off', async () => {
    mocked.me.enableDeviceSignIn.mockResolvedValue({ id: ID, secret: 's1' });
    await deviceSignIn.enable('ada@example.com');
    mocked.auth.deviceSignIn.mockRejectedValue(new ApiError(401, 'No longer set up.'));
    await expect(deviceSignIn.signIn()).rejects.toThrow('No longer set up.');
    expect(deviceSignIn.account()).toBeNull();
    expect(saved()).toBeNull();
  });

  it('turns off on the server and on the phone', async () => {
    mocked.me.enableDeviceSignIn.mockResolvedValue({ id: ID, secret: 's1' });
    await deviceSignIn.enable('ada@example.com');
    mocked.me.revokeDeviceSignIn.mockResolvedValue(undefined);
    await deviceSignIn.disable();
    expect(mocked.me.revokeDeviceSignIn).toHaveBeenCalledWith(ID);
    expect(deviceSignIn.account()).toBeNull();
  });

  it('offers it once per account', async () => {
    expect(await deviceSignIn.shouldOffer('ada@example.com')).toBe(true);
    await deviceSignIn.markOffered('ada@example.com');
    expect(await deviceSignIn.shouldOffer('ada@example.com')).toBe(false);
    expect(await deviceSignIn.shouldOffer('grace@example.com')).toBe(true);
  });
});
