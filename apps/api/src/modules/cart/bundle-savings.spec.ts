import { bundleSavings } from './bundle-savings';

const rule = (
  id: string,
  percentOff: number,
  productIds: string[],
  sellerId: string | null = null,
) => ({
  id,
  title: id,
  percentOff,
  sellerId,
  productIds,
});

describe('bundleSavings', () => {
  it('takes the percentage off each complete set only', () => {
    const result = bundleSavings(
      [
        { productId: 'a', unitPriceCents: 3_000, quantity: 2 },
        { productId: 'b', unitPriceCents: 1_000, quantity: 1 },
      ],
      [rule('ab', 10, ['a', 'b'])],
    );
    expect(result).toEqual([
      { id: 'ab', title: 'ab', percentOff: 10, sets: 1, discountCents: 400, sellerId: null },
    ]);
  });

  it('needs every product of the bundle', () => {
    expect(
      bundleSavings(
        [{ productId: 'a', unitPriceCents: 3_000, quantity: 3 }],
        [rule('ab', 10, ['a', 'b'])],
      ),
    ).toEqual([]);
  });

  it('never discounts a unit twice; the bigger percentage wins it', () => {
    const result = bundleSavings(
      [
        { productId: 'a', unitPriceCents: 2_000, quantity: 1 },
        { productId: 'b', unitPriceCents: 1_000, quantity: 1 },
        { productId: 'c', unitPriceCents: 1_000, quantity: 1 },
      ],
      [rule('ab', 10, ['a', 'b']), rule('ac', 20, ['a', 'c'], 's1')],
    );
    expect(result.map((r) => [r.id, r.sets, r.discountCents, r.sellerId])).toEqual([
      ['ac', 1, 600, 's1'],
    ]);
  });

  it('uses the cheapest units when variants are priced differently', () => {
    const result = bundleSavings(
      [
        { productId: 'a', unitPriceCents: 5_000, quantity: 1 },
        { productId: 'a', unitPriceCents: 4_000, quantity: 1 },
        { productId: 'b', unitPriceCents: 1_000, quantity: 1 },
      ],
      [rule('ab', 10, ['a', 'b'])],
    );
    expect(result[0]?.discountCents).toBe(500);
  });
});
