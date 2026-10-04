/** Per-IP rate limits for @Throttle(), on top of the global default (app.module.ts). */

const MINUTE = 60_000;
const HOUR = 3_600_000;

/** At most `limit` requests a minute from one IP. */
export const perMinute = (limit: number) => ({ default: { limit, ttl: MINUTE } });

/** At most `limit` requests an hour from one IP (contact forms, data exports). */
export const perHour = (limit: number) => ({ default: { limit, ttl: HOUR } });

/** Password and code checks: sign-in, passkey sign-in, two-step codes. */
export const SIGN_IN_LIMIT = perMinute(10);

/** Actions that send email or change credentials (sign-up, resets, verification). */
export const STRICT_LIMIT = perMinute(5);
