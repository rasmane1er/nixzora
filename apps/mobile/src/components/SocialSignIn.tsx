import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import { type LoginResponse } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Crypto from 'expo-crypto';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, useColorScheme, View } from 'react-native';
import { Banner, Button, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { deviceName } from '@/lib/device';
import { radius, space, usePalette } from '@/lib/theme';

// Closes the Google sign-in browser tab when it redirects back into the app (web builds).
WebBrowser.maybeCompleteAuthSession();

type Props = {
  /** Called with the API's answer: tokens, or an MFA challenge. */
  onResult: (result: LoginResponse) => void | Promise<void>;
  intent?: 'signin' | 'signup';
};

/**
 * "Continue with Apple" (iOS) and "Continue with Google". The ID token goes to the API, which
 * checks it against Apple's / Google's keys. Buttons appear only for providers the API has set up.
 */
export function SocialSignIn({ onResult, intent = 'signin' }: Props) {
  const scheme = useColorScheme();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const providers = useQuery({
    queryKey: ['auth', 'social-providers'],
    queryFn: () => api.auth.socialProviders(),
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable);
  }, []);

  const google = providers.data?.google;
  const googleClientId =
    Platform.OS === 'ios'
      ? google?.iosClientId
      : Platform.OS === 'android'
        ? google?.androidClientId
        : google?.webClientId;
  const showApple = appleAvailable && providers.data?.apple !== null && !!providers.data;

  async function finish(run: () => Promise<LoginResponse | null>) {
    setBusy(true);
    setError(null);
    try {
      const result = await run();
      if (result) await onResult(result);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function signInWithApple() {
    void finish(async () => {
      // Apple puts the SHA-256 of our nonce in the token; the API checks it against the raw one.
      const nonce = Crypto.randomUUID() + Crypto.randomUUID();
      const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, nonce);
      let credential: AppleAuthentication.AppleAuthenticationCredential;
      try {
        credential = await AppleAuthentication.signInAsync({
          requestedScopes: [
            AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
            AppleAuthentication.AppleAuthenticationScope.EMAIL,
          ],
          nonce: hashed,
        });
      } catch (e) {
        if ((e as { code?: string }).code === 'ERR_REQUEST_CANCELED') return null;
        throw e;
      }
      if (!credential.identityToken) throw new Error('Apple did not return a sign-in token.');
      return api.auth.social({
        provider: 'apple',
        idToken: credential.identityToken,
        nonce,
        // Apple shares the name only the first time someone signs in to this app.
        firstName: credential.fullName?.givenName ?? undefined,
        lastName: credential.fullName?.familyName ?? undefined,
        deviceName: deviceName(),
      });
    });
  }

  // Expo Go runs under its own bundle id, which Google and Apple reject for NIXZORA: the buttons
  // only work in a development or store build (npx expo run:ios / EAS).
  if (Constants.executionEnvironment === ExecutionEnvironment.StoreClient) return null;
  if (!showApple && !googleClientId) return null;

  return (
    <View style={{ gap: space.sm }}>
      {showApple ? (
        <AppleAuthentication.AppleAuthenticationButton
          buttonType={
            intent === 'signup'
              ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
              : AppleAuthentication.AppleAuthenticationButtonType.CONTINUE
          }
          buttonStyle={
            scheme === 'dark'
              ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
              : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
          }
          cornerRadius={radius}
          style={{ height: 48, width: '100%', opacity: busy ? 0.55 : 1 }}
          onPress={busy ? () => undefined : signInWithApple}
        />
      ) : null}
      {googleClientId && google ? (
        <GoogleButton
          clientIds={google}
          busy={busy}
          intent={intent}
          onToken={(idToken, nonce) =>
            void finish(() =>
              api.auth.social({ provider: 'google', idToken, nonce, deviceName: deviceName() }),
            )
          }
        />
      ) : null}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Text muted variant="small" style={{ textAlign: 'center', marginTop: space.xs }}>
        or use your email
      </Text>
    </View>
  );
}

/** Mounted only when a client id exists for this platform (the hook requires one). */
function GoogleButton({
  clientIds,
  busy,
  intent,
  onToken,
}: {
  clientIds: {
    webClientId: string | null;
    iosClientId: string | null;
    androidClientId: string | null;
  };
  busy: boolean;
  intent: 'signin' | 'signup';
  onToken: (idToken: string, nonce: string | undefined) => void;
}) {
  const p = usePalette();
  const [request, response, prompt] = Google.useIdTokenAuthRequest({
    webClientId: clientIds.webClientId ?? undefined,
    iosClientId: clientIds.iosClientId ?? undefined,
    androidClientId: clientIds.androidClientId ?? undefined,
    selectAccount: true,
  });

  useEffect(() => {
    if (response?.type !== 'success') return;
    const idToken = response.params.id_token;
    if (idToken) onToken(idToken, request?.nonce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  return (
    <Button
      title={intent === 'signup' ? 'Sign up with Google' : 'Continue with Google'}
      tone="ghost"
      icon={<Ionicons name="logo-google" size={18} color={p.fg} />}
      disabled={!request || busy}
      onPress={() => void prompt()}
    />
  );
}
