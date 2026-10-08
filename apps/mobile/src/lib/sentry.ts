import * as Sentry from '@sentry/react-native';
import { APP_VARIANT } from './config';

/**
 * Crash and error reports (Sentry project opportunity-corridor/nixzora-mobile).
 *
 * Only crashes and errors are sent: no session replay, no screenshots, no IP address or
 * other personal data (sendDefaultPii is off and the user is identified by account id only).
 * The DSN is a public, send-only key; builds without it (local development, tests) send nothing.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

const sentryEnabled = !!dsn && !__DEV__;

Sentry.init({
  dsn,
  enabled: sentryEnabled,
  environment: APP_VARIANT,
  sendDefaultPii: false,
  attachScreenshot: false,
  attachViewHierarchy: false,
  enableNativeCrashHandling: true,
  // A small sample of performance traces (app start, screen loads); errors are always sent.
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Defence in depth: never ship request bodies, cookies or headers.
    if (event.request) {
      delete event.request.data;
      delete event.request.cookies;
      delete event.request.headers;
    }
    return event;
  },
});

/** Tag reports with the account id (never the email) so a crash can be matched to a support ticket. */
export function setSentryUser(id: string | null): void {
  Sentry.setUser(id ? { id } : null);
}

/**
 * Preview builds only: sends one test error from Settings to check that reports reach Sentry.
 * Each report has its own message, so the SDK's duplicate filter never drops it. Returns the
 * event id, or null when reporting is off in this build (no DSN, or a development build).
 */
export async function sendTestReport(): Promise<string | null> {
  if (!sentryEnabled) return null;
  const id = Sentry.captureException(
    new Error(`Test report from Settings, ${APP_VARIANT}, ${new Date().toISOString()}`),
  );
  await Sentry.flush();
  return id;
}

export { Sentry };
