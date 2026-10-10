/**
 * Where a product page view came from (p10-25), for store analytics. Worked out from the
 * previous page's path (same site) or whether there was another site before; the app says APP.
 */
export const TRAFFIC_SOURCES = [
  'SEARCH',
  'CATEGORY',
  'STORE',
  'DEALS',
  'RECOMMENDED',
  'FOLLOWING',
  'ASSISTANT',
  'EXTERNAL',
  'DIRECT',
  'APP',
] as const;
export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

/**
 * `referrer` is document.referrer (may be empty); `origin` is the store's own origin. Only the
 * path of an own-site referrer is looked at, never another site's address.
 */
export function trafficSource(referrer: string | null | undefined, origin: string): TrafficSource {
  if (!referrer) return 'DIRECT';
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return 'DIRECT';
  }
  if (url.origin !== origin) return 'EXTERNAL';
  const path = url.pathname;
  if (path.startsWith('/search') || path.startsWith('/photo')) return 'SEARCH';
  if (path.startsWith('/c/') || path.startsWith('/brand')) return 'CATEGORY';
  if (path.startsWith('/s/')) return 'STORE';
  if (path.startsWith('/deals') || path.startsWith('/coupons')) return 'DEALS';
  if (path.startsWith('/following')) return 'FOLLOWING';
  if (path.startsWith('/assistant')) return 'ASSISTANT';
  // The home page, other products ("customers also viewed"), lists, the cart and the account.
  return 'RECOMMENDED';
}
