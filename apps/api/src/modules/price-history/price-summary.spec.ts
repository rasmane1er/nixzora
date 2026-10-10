import { summarizePrices } from './price-summary';

const now = new Date('2026-10-15T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);

describe('summarizePrices', () => {
  it('starts the window at the price in effect then, and weights by time', () => {
    const h = summarizePrices(
      [
        { at: daysAgo(200), priceCents: 10_000 },
        { at: daysAgo(30), priceCents: 8_000 },
      ],
      8_000,
      90,
      'USD',
      now,
    );
    expect(h.points).toEqual([
      { at: daysAgo(90).toISOString(), priceCents: 10_000 },
      { at: daysAgo(30).toISOString(), priceCents: 8_000 },
    ]);
    // 60 days at $100, 30 days at $80.
    expect(h.typicalCents).toBe(9_333);
    expect(h).toMatchObject({ lowestCents: 8_000, highestCents: 10_000, changed: true });
    expect(h.lowestIn30Days).toBe(true);
  });

  it('is a flat line with no claims when the price never changed', () => {
    const h = summarizePrices([{ at: daysAgo(10), priceCents: 5_000 }], 5_000, 30, 'USD', now);
    expect(h).toMatchObject({ changed: false, lowestIn30Days: false, typicalCents: 5_000 });
    const none = summarizePrices([], 5_000, 30, 'USD', now);
    expect(none.points).toEqual([{ at: daysAgo(30).toISOString(), priceCents: 5_000 }]);
  });

  it("isn't the lowest in 30 days when it was cheaper a week ago", () => {
    const h = summarizePrices(
      [
        { at: daysAgo(60), priceCents: 10_000 },
        { at: daysAgo(10), priceCents: 7_000 },
        { at: daysAgo(3), priceCents: 9_000 },
      ],
      9_000,
      90,
      'USD',
      now,
    );
    expect(h.lowestIn30Days).toBe(false);
  });

  it('adds today when the latest change is not recorded yet', () => {
    const h = summarizePrices([{ at: daysAgo(40), priceCents: 6_000 }], 5_500, 30, 'USD', now);
    expect(h.points.at(-1)).toEqual({ at: now.toISOString(), priceCents: 5_500 });
  });
});
