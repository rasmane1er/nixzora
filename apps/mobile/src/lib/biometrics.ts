import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';

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
    cancelLabel: 'Cancel',
    // Allow the device passcode as a fallback, like banking apps do.
    disableDeviceFallback: false,
  });
  return result.success;
}
