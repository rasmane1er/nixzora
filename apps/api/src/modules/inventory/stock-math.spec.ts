import { availableOf, holdExpiry, planCommit, sumByVariant } from './stock-math';

describe('stock math', () => {
  it('adds up lines for the same variant', () => {
    expect(
      sumByVariant([
        { variantId: 'a', quantity: 1 },
        { variantId: 'b', quantity: 2 },
        { variantId: 'a', quantity: 3 },
      ]),
    ).toEqual(
      new Map([
        ['a', 4],
        ['b', 2],
      ]),
    );
  });

  it('never reports negative availability', () => {
    expect(availableOf(5, 2)).toBe(3);
    expect(availableOf(1, 4)).toBe(0);
  });

  it('computes hold expiry from minutes', () => {
    expect(holdExpiry(15, 0).getTime()).toBe(15 * 60_000);
  });

  describe('planCommit', () => {
    const wanted = new Map([['a', 3]]);

    it('uses the order’s own holds first', () => {
      const plan = planCommit(wanted, new Map([['a', { onHand: 10, reserved: 3 }]]), wanted);
      expect(plan).toEqual([{ variantId: 'a', fromHold: 3, fromFree: 0, missing: 0 }]);
    });

    it('takes free stock when the hold expired', () => {
      const plan = planCommit(wanted, new Map([['a', { onHand: 10, reserved: 8 }]]), new Map());
      expect(plan).toEqual([{ variantId: 'a', fromHold: 0, fromFree: 2, missing: 1 }]);
    });

    it('mixes a partial hold with free stock', () => {
      const plan = planCommit(
        wanted,
        new Map([['a', { onHand: 4, reserved: 1 }]]),
        new Map([['a', 1]]),
      );
      expect(plan).toEqual([{ variantId: 'a', fromHold: 1, fromFree: 2, missing: 0 }]);
    });

    it('reports everything missing for a variant without a stock row', () => {
      expect(planCommit(wanted, new Map(), new Map())).toEqual([
        { variantId: 'a', fromHold: 0, fromFree: 0, missing: 3 },
      ]);
    });
  });
});
