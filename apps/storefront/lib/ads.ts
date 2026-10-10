import 'server-only';

import { type SponsoredProduct, type SponsoredProducts } from '@nixzora/validation';
import { api } from './api';
import { visitorId } from './visitor';

/**
 * Sponsored products for a page (p10-01). Never fails the page: no ads is a fine answer. Sent
 * with the visitor id and sign-in, so a seller's own team is never charged for its clicks.
 */
export async function sponsored(
  query:
    | { placement: 'search'; q: string }
    | { placement: 'category'; category: string }
    | { placement: 'product'; product: string }
    | { placement: 'home' },
): Promise<SponsoredProduct[]> {
  const visitor = await visitorId();
  const params = new URLSearchParams({ ...query, ...(visitor ? { visitorId: visitor } : {}) });
  return api<SponsoredProducts>(`/ads?${params}`)
    .then((res) => res.ads)
    .catch(() => []);
}

/** Where a sponsored card links: records the click, then opens the product. */
export function adHref(token: string): string {
  return `/r/ad?t=${encodeURIComponent(token)}`;
}
