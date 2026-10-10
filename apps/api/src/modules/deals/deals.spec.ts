import { DealCreateSchema } from '@nixzora/validation';
import { dealPrice } from './deals.service';

describe('deals', () => {
  it('rounds the deal price to whole cents and never reaches zero', () => {
    expect(dealPrice(10_000, 25)).toBe(7_500);
    expect(dealPrice(8_900, 30)).toBe(6_230);
    expect(dealPrice(999, 33)).toBe(669);
    expect(dealPrice(1, 80)).toBe(1);
  });

  it('caps lightning deals at 12 hours and day deals at 7 days', () => {
    const base = { productId: '01a0fb3e-d5da-7279-a279-8a2bd91ed373', percentOff: 20 };
    const start = '2026-10-12T09:00:00.000Z';
    expect(
      DealCreateSchema.safeParse({
        ...base,
        kind: 'LIGHTNING',
        startsAt: start,
        endsAt: '2026-10-12T21:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      DealCreateSchema.safeParse({
        ...base,
        kind: 'LIGHTNING',
        startsAt: start,
        endsAt: '2026-10-12T21:01:00.000Z',
      }).success,
    ).toBe(false);
    expect(
      DealCreateSchema.safeParse({
        ...base,
        kind: 'DAY',
        startsAt: start,
        endsAt: '2026-10-19T09:00:00.000Z',
      }).success,
    ).toBe(true);
    expect(
      DealCreateSchema.safeParse({ ...base, kind: 'DAY', startsAt: start, endsAt: start }).success,
    ).toBe(false);
  });
});
