import { createHmac, timingSafeEqual } from 'node:crypto';
import { AD_PLACEMENTS, type AdPlacement } from '@nixzora/validation';

/** What an ad link carries: which ad was shown, where, and the price set by the auction. */
export type AdTicket = {
  campaignId: string;
  productId: string;
  sellerId: string;
  slug: string;
  placement: AdPlacement;
  costCents: number;
  /** Expiry, epoch milliseconds. */
  expiresAt: number;
};

/** An ad opened more than this long after it was shown is not charged. */
export const AD_TOKEN_TTL_MS = 30 * 60 * 1000;

/**
 * Signed ad links (p10-01). The price is decided when the ad is shown, so the click endpoint must
 * be able to trust it: tokens are HMAC-SHA256 signed with a key derived from ORDER_LINK_SECRET
 * (no new secret to provision) and expire after 30 minutes.
 */
export class AdTokens {
  private readonly key: Buffer;

  constructor(secret: string) {
    this.key = createHmac('sha256', secret).update('nixzora/ad-click/v1').digest();
  }

  sign(ticket: AdTicket): string {
    const body = Buffer.from(
      JSON.stringify([
        ticket.campaignId,
        ticket.productId,
        ticket.sellerId,
        ticket.slug,
        AD_PLACEMENTS.indexOf(ticket.placement),
        ticket.costCents,
        ticket.expiresAt,
      ]),
    ).toString('base64url');
    return `${body}.${this.mac(body)}`;
  }

  /** The ticket, or null when the token was altered or is malformed. Expiry is checked by callers. */
  verify(token: string): AdTicket | null {
    const [body, mac] = token.split('.');
    if (!body || !mac) return null;
    const expected = Buffer.from(this.mac(body));
    const given = Buffer.from(mac);
    if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
    try {
      const raw = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as unknown;
      if (!Array.isArray(raw) || raw.length !== 7) return null;
      const [campaignId, productId, sellerId, slug, placement, costCents, expiresAt] = raw as [
        string,
        string,
        string,
        string,
        number,
        number,
        number,
      ];
      const where = AD_PLACEMENTS[placement];
      if (!where || !Number.isInteger(costCents) || costCents < 0) return null;
      return { campaignId, productId, sellerId, slug, placement: where, costCents, expiresAt };
    } catch {
      return null;
    }
  }

  private mac(body: string): string {
    return createHmac('sha256', this.key).update(body).digest('base64url');
  }
}
