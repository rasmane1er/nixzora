import 'server-only';

import { randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { cookieOptions } from './session';

/**
 * A random id the browser keeps for recommendations before sign-in. It identifies no one; the
 * privacy policy covers it and it is deleted with the other shopping data after 180 days.
 */
export const VISITOR_COOKIE = 'nx_vid';
const ONE_YEAR = 365 * 24 * 60 * 60;

export async function visitorId(): Promise<string | undefined> {
  const value = (await cookies()).get(VISITOR_COOKIE)?.value;
  return value && /^[A-Za-z0-9_-]{16,64}$/.test(value) ? value : undefined;
}

/** Only from a server action or route handler (pages cannot set cookies). */
export async function ensureVisitorId(): Promise<string> {
  const existing = await visitorId();
  if (existing) return existing;
  const id = randomBytes(18).toString('base64url');
  (await cookies()).set(VISITOR_COOKIE, id, cookieOptions(ONE_YEAR));
  return id;
}
