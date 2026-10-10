/**
 * Universal links (iOS) and App Links (Android): which storefront URLs open in the NIXZORA app
 * when it is installed. Configured per environment; when unset the files answer 404 and links
 * simply stay in the browser.
 */
export const APP_LINK_PATHS = ['/p/*', '/c/*', '/search', '/cart', '/orders/*', '/r/*'];

function list(value: string | undefined): string[] {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** e.g. "ABCDE12345.com.nixzora.shop" (Apple team id + bundle id). */
export const iosAppIds = () => list(process.env.IOS_APP_IDS);

/** SHA-256 fingerprints of the Android signing certificates (EAS or Play App Signing). */
export const androidFingerprints = () => list(process.env.ANDROID_CERT_FINGERPRINTS);

export const androidPackage = () => process.env.ANDROID_PACKAGE ?? 'com.nixzora.shop';
