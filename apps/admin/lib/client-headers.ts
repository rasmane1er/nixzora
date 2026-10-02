import 'server-only';
import { headers } from 'next/headers';

/**
 * Relays the visitor's IP and browser to the API, signed with the internal key, so rate limits,
 * sessions and the audit log see the real visitor instead of this web server. Behind the AWS
 * load balancer the last X-Forwarded-For entry is the one the balancer added: the true client.
 */
export async function clientHeaders(): Promise<Record<string, string>> {
  const key = process.env.INTERNAL_API_KEY;
  if (!key) return {};
  try {
    const incoming = await headers();
    const ip = incoming
      .get('x-forwarded-for')
      ?.split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .pop();
    const agent = incoming.get('user-agent');
    return {
      'X-Internal-Key': key,
      ...(ip ? { 'X-Client-IP': ip } : {}),
      ...(agent ? { 'X-Client-User-Agent': agent.slice(0, 500) } : {}),
    };
  } catch {
    // Outside a request (build time, background revalidation): nothing to relay.
    return {};
  }
}
