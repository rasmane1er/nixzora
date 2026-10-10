import { AdTokens } from './ad-token';
import { clickPrice } from './ads.service';

const ad = (bidCents: number, quality: number, capCents = 10_000) =>
  ({ bidCents, quality, capCents, adRank: bidCents * quality }) as Parameters<typeof clickPrice>[0];

describe('ad click price (second price)', () => {
  it('pays just enough to stay above the next ad', () => {
    expect(clickPrice(ad(100, 1), ad(50, 1))).toBe(51);
    // A more relevant ad pays less to beat the same competitor.
    expect(clickPrice(ad(100, 1), ad(50, 0.5))).toBe(26);
  });

  it('never pays more than its bid, its cap or less than the reserve', () => {
    expect(clickPrice(ad(60, 0.5), ad(80, 0.4))).toBe(60);
    expect(clickPrice(ad(100, 1, 30), ad(90, 1))).toBe(30);
    expect(clickPrice(ad(100, 1), undefined)).toBe(10);
    expect(clickPrice(ad(100, 1), ad(1, 1))).toBe(10);
  });
});

describe('ad tokens', () => {
  const tokens = new AdTokens('a'.repeat(40));
  const ticket = {
    campaignId: '01a12342-f1c8-7000-8000-000000000001',
    productId: '01a12342-f1c8-7000-8000-000000000002',
    sellerId: '01a12342-f1c8-7000-8000-000000000003',
    slug: 'brass-lamp',
    placement: 'search' as const,
    costCents: 51,
    expiresAt: 1_800_000_000_000,
  };

  it('round-trips a signed ticket', () => {
    expect(tokens.verify(tokens.sign(ticket))).toEqual(ticket);
  });

  it('refuses altered or foreign tokens', () => {
    const token = tokens.sign(ticket);
    const [body, mac] = token.split('.');
    const cheaper = Buffer.from(
      Buffer.from(body!, 'base64url').toString().replace(',51,', ',1,'),
    ).toString('base64url');
    expect(tokens.verify(`${cheaper}.${mac}`)).toBeNull();
    expect(new AdTokens('b'.repeat(40)).verify(token)).toBeNull();
    expect(tokens.verify('nonsense')).toBeNull();
  });
});
