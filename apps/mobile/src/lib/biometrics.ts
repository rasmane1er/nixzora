import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { useEffect, useState } from 'react';
import { t, useT } from './i18n';

export type BiometricKind = 'Face ID' | 'Touch ID' | 'fingerprint' | 'biometrics';

/** What the phone offers, or null when there is no enrolled biometric. */
export async function availableBiometric(): Promise<BiometricKind | null> {
  if (Platform.OS === 'web') return null;
  const [hardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  if (!hardware || !enrolled) return null;
  const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
  const face = types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION);
  if (Platform.OS === 'ios') return face ? 'Face ID' : 'Touch ID';
  return types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)
    ? 'fingerprint'
    : 'biometrics';
}

export async function confirmIdentity(prompt: string): Promise<boolean> {
  if (Platform.OS === 'web') return true;
  const result = await LocalAuthentication.authenticateAsync({
    promptMessage: prompt,
    cancelLabel: t('common')('cancel'),
    // Allow the device passcode as a fallback, like banking apps do.
    disableDeviceFallback: false,
  });
  return result.success;
}

const WORD: Partial<Record<BiometricKind, 'bioFingerprint' | 'bioBiometrics'>> = {
  fingerprint: 'bioFingerprint',
  biometrics: 'bioBiometrics',
};

/** "Face ID", "Touch ID", "fingerprint"… in the app's language, or null without biometrics. */
export function useBiometricName(): string | null {
  const t = useT('appAccount');
  const [kind, setKind] = useState<BiometricKind | null>(null);
  useEffect(() => {
    let active = true;
    void availableBiometric()
      .then((value) => active && setKind(value))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  if (!kind) return null;
  const word = WORD[kind];
  return word ? t(word) : kind;
}
