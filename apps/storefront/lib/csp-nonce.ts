import 'server-only';
import { headers } from 'next/headers';

/** This page view's Content Security Policy nonce (set by proxy.ts), for third-party scripts. */
export async function cspNonce(): Promise<string | undefined> {
  return (await headers()).get('x-nonce') ?? undefined;
}
