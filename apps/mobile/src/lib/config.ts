import Constants from 'expo-constants';
import { Platform } from 'react-native';

function trim(url: string): string {
  return url.replace(/\/$/, '');
}

/**
 * The NIXZORA API. On a phone, "localhost" is the phone itself: point EXPO_PUBLIC_API_URL at
 * your computer's LAN address (e.g. http://192.168.1.20:4000) or a tunnel. The Android
 * emulator reaches the host at 10.0.2.2.
 */
export const API_URL = trim(
  process.env.EXPO_PUBLIC_API_URL ??
    (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000'),
);

/** The storefront, for links that only exist on the web (legal pages, password reset). */
export const WEB_URL = trim(process.env.EXPO_PUBLIC_WEB_URL ?? 'http://localhost:3000');

const extra = (Constants.expoConfig?.extra ?? {}) as {
  variant?: string;
  merchantId?: string;
  eas?: { projectId?: string };
};

export const APP_VARIANT = extra.variant ?? 'development';
export const MERCHANT_ID = extra.merchantId ?? 'merchant.com.nixzora.shop';
export const EAS_PROJECT_ID = extra.eas?.projectId;
export const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';
