import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { type ReactNode } from 'react';
import type * as ReactNative from 'react-native';
import { SocialSignIn } from '@/components/SocialSignIn';
import { api } from '@/lib/api';

jest.mock('@/lib/api', () => ({
  api: { auth: { socialProviders: jest.fn(), social: jest.fn() } },
}));
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: jest.fn(),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { SIGN_IN: 0, CONTINUE: 1, SIGN_UP: 2 },
  AppleAuthenticationButtonStyle: { WHITE: 0, WHITE_OUTLINE: 1, BLACK: 2 },
  AppleAuthenticationButton: ({ onPress }: { onPress: () => void }) => {
    const { Pressable, Text } = jest.requireActual<typeof ReactNative>('react-native');
    return (
      <Pressable accessibilityRole="button" onPress={onPress}>
        <Text>Continue with Apple</Text>
      </Pressable>
    );
  },
}));
jest.mock('expo-crypto', () => ({
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
  digestStringAsync: jest.fn(async () => 'hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));
jest.mock('expo-auth-session/providers/google', () => ({
  useIdTokenAuthRequest: () => [{ nonce: 'google-nonce' }, null, jest.fn()],
}));

const providers = api.auth.socialProviders as jest.Mock;
const social = api.auth.social as jest.Mock;
const appleAvailable = AppleAuthentication.isAvailableAsync as jest.Mock;
const appleSignIn = AppleAuthentication.signInAsync as jest.Mock;

const tokens = {
  accessToken: 'access',
  accessTokenExpiresIn: 900,
  refreshToken: 'refresh-token-xxxxxxxxxxxxxxxxxxxx',
  refreshTokenExpiresAt: '2027-01-01T00:00:00.000Z',
  sessionId: '01900000-0000-7000-8000-000000000000',
};

function wrap(children: ReactNode) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => jest.clearAllMocks());

it('shows nothing when no provider is set up', async () => {
  providers.mockResolvedValue({ google: null, apple: null });
  appleAvailable.mockResolvedValue(false);
  render(wrap(<SocialSignIn onResult={jest.fn()} />));
  await waitFor(() => expect(providers).toHaveBeenCalled());
  expect(screen.queryByText(/Continue with/)).toBeNull();
});

it('signs in with Apple, sending the raw nonce and the first-time name', async () => {
  providers.mockResolvedValue({
    google: { webClientId: 'web', iosClientId: 'ios', androidClientId: null },
    apple: { servicesId: null },
  });
  appleAvailable.mockResolvedValue(true);
  appleSignIn.mockResolvedValue({
    identityToken: 'apple-id-token',
    fullName: { givenName: 'Ada', familyName: 'Lovelace' },
  });
  social.mockResolvedValue(tokens);
  const onResult = jest.fn();

  render(wrap(<SocialSignIn onResult={onResult} />));
  expect(await screen.findByText('Continue with Google')).toBeTruthy();
  fireEvent.press(await screen.findByText('Continue with Apple'));

  await waitFor(() => expect(onResult).toHaveBeenCalledWith(tokens));
  expect(appleSignIn).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'hashed-nonce' }));
  expect(social).toHaveBeenCalledWith(
    expect.objectContaining({
      provider: 'apple',
      idToken: 'apple-id-token',
      nonce: expect.stringMatching(/^0{8}-/),
      firstName: 'Ada',
      lastName: 'Lovelace',
    }),
  );
});

it('stays quiet when the person cancels the Apple sheet', async () => {
  providers.mockResolvedValue({ google: null, apple: { servicesId: null } });
  appleAvailable.mockResolvedValue(true);
  appleSignIn.mockRejectedValue(
    Object.assign(new Error('canceled'), { code: 'ERR_REQUEST_CANCELED' }),
  );
  const onResult = jest.fn();

  render(wrap(<SocialSignIn onResult={onResult} />));
  fireEvent.press(await screen.findByText('Continue with Apple'));
  await waitFor(() => expect(appleSignIn).toHaveBeenCalled());
  expect(social).not.toHaveBeenCalled();
  expect(onResult).not.toHaveBeenCalled();
  expect(screen.queryByRole('alert')).toBeNull();
});
