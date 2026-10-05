import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One codebase, three installable variants that can sit side by side on a phone:
 *  development — dev client against your laptop's API
 *  preview     — TestFlight / Play internal testing against staging
 *  production  — the store app
 * EAS sets APP_VARIANT per build profile (eas.json).
 */
type Variant = 'development' | 'preview' | 'production';
const variant = (process.env.APP_VARIANT ?? 'development') as Variant;

const BUNDLE_ID: Record<Variant, string> = {
  development: 'com.nixzora.shop.dev',
  preview: 'com.nixzora.shop.preview',
  production: 'com.nixzora.shop',
};
const NAME: Record<Variant, string> = {
  development: 'NIXZORA Dev',
  preview: 'NIXZORA Preview',
  production: 'NIXZORA',
};

/** The Expo project (public identifiers, not secrets). Override with EAS_PROJECT_ID / EXPO_OWNER. */
const projectId = process.env.EAS_PROJECT_ID ?? '39db3a5f-ab8e-467b-a427-b7641d6ea56d';
const owner = process.env.EXPO_OWNER ?? 'grasmane';
/** FCM config for Android push: an EAS "file" environment variable, never committed. */
const googleServicesFile = process.env.GOOGLE_SERVICES_JSON;

/** The storefront domain whose links open in the app, e.g. "nixzora.shop" (no scheme). */
const linkDomain = process.env.APP_LINK_DOMAIN;
/** Apple Pay merchant id registered in the Apple Developer account. */
const merchantId = process.env.APPLE_MERCHANT_ID ?? 'merchant.com.nixzora.shop';
/**
 * Google sign-in on iOS returns to the app through the iOS OAuth client's reversed id, e.g.
 * "com.googleusercontent.apps.1234-abcd" (public, from Google Cloud → Credentials).
 */
const googleIosScheme = process.env.GOOGLE_IOS_URL_SCHEME;
const LINK_PATHS = ['/p/', '/c/', '/orders/', '/search', '/cart'];

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: NAME[variant],
  slug: 'nixzora',
  owner,
  version: '1.0.0',
  // Phones are locked upright at start-up and tablets turn freely (src/lib/orientation.ts).
  orientation: 'default',
  icon: './assets/icon.png',
  // Extra schemes for Google sign-in: Android returns to "<package>:/oauthredirect", iOS to the
  // iOS client's reversed id.
  scheme: [
    variant === 'production' ? 'nixzora' : `nixzora-${variant}`,
    BUNDLE_ID[variant],
    ...(googleIosScheme ? [googleIosScheme] : []),
  ],
  userInterfaceStyle: 'automatic',
  runtimeVersion: { policy: 'appVersion' },
  // Over-the-air JavaScript updates (EAS Update) for the build's channel.
  updates: { url: `https://u.expo.dev/${projectId}` },
  ios: {
    bundleIdentifier: BUNDLE_ID[variant],
    usesAppleSignIn: true,
    // iOS 18+ home-screen appearances: default, dark and tinted.
    icon: {
      light: './assets/icon.png',
      dark: './assets/icon-dark.png',
      tinted: './assets/icon-tinted.png',
    },
    supportsTablet: true,
    associatedDomains: linkDomain ? [`applinks:${linkDomain}`, `webcredentials:${linkDomain}`] : [],
    infoPlist: {
      // Only standard HTTPS/TLS: no export-compliance paperwork for TestFlight.
      ITSAppUsesNonExemptEncryption: false,
    },
  },
  android: {
    package: BUNDLE_ID[variant],
    ...(googleServicesFile ? { googleServicesFile } : {}),
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      monochromeImage: './assets/adaptive-icon-monochrome.png',
      backgroundColor: '#0E1726',
    },
    // The app only scans barcodes: no microphone, no shared storage.
    blockedPermissions: [
      'android.permission.RECORD_AUDIO',
      'android.permission.READ_EXTERNAL_STORAGE',
      'android.permission.WRITE_EXTERNAL_STORAGE',
    ],
    intentFilters: linkDomain
      ? [
          {
            action: 'VIEW',
            autoVerify: true,
            data: LINK_PATHS.map((pathPrefix) => ({
              scheme: 'https',
              host: linkDomain,
              pathPrefix,
            })),
            category: ['BROWSABLE', 'DEFAULT'],
          },
        ]
      : [],
  },
  web: {
    output: 'single',
    favicon: './assets/favicon.png',
    bundler: 'metro',
  },
  plugins: [
    'expo-router',
    [
      'expo-splash-screen',
      {
        image: './assets/splash-icon.png',
        imageWidth: 96,
        backgroundColor: '#F6F5F1',
        dark: { image: './assets/splash-icon.png', backgroundColor: '#0B111B' },
      },
    ],
    'expo-font',
    'expo-image',
    'expo-web-browser',
    ['expo-screen-orientation', { initialOrientation: 'DEFAULT' }],
    [
      'expo-image-picker',
      {
        photosPermission: 'Choose a profile photo for your NIXZORA account.',
        cameraPermission: 'Take a profile photo for your NIXZORA account.',
      },
    ],
    'expo-apple-authentication',
    ['expo-secure-store', { faceIDPermission: 'Use Face ID to unlock your NIXZORA account.' }],
    [
      'expo-local-authentication',
      { faceIDPermission: 'Use Face ID to unlock your NIXZORA account.' },
    ],
    [
      'expo-camera',
      {
        cameraPermission: 'Scan a product barcode to find it in NIXZORA.',
        microphonePermission: false,
        recordAudioAndroid: false,
      },
    ],
    ['expo-notifications', { icon: './assets/notification-icon.png', color: '#E8622C' }],
    ['@stripe/stripe-react-native', { merchantIdentifier: merchantId, enableGooglePay: true }],
  ],
  extra: {
    variant,
    merchantId,
    ...(projectId ? { eas: { projectId } } : {}),
  },
});
