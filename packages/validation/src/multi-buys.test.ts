import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MultiBuyCreateSchema, multiBuySavings, multiBuyText } from './multi-buys';

const offer = {
  id: 'o1',
  buyQty: 2,
  getQty: 1,
  percentOff: 100,
  sellerId: null,
  productIds: ['a', 'b'],
};

test('the cheapest of each group of three is free, across products', () => {
  const [s] = multiBuySavings(
    new Map([
      ['a', [1000, 1000]],
      ['b', [400]],
    ]),
    [offer],
  );
  assert.deepEqual(
    { times: s!.times, discountCents: s!.discountCents, addMore: s!.addMore },
    { times: 1, discountCents: 400, addMore: 0 },
  );
});

test('groups take the most expensive first; a partial group asks for more', () => {
  const [s] = multiBuySavings(new Map([['a', [100, 200, 300, 400, 500, 600, 700, 800]]]), [offer]);
  // [800 700 600] [500 400 300] → 600 + 300 free; 200 and 100 left, 1 more gets one free.
  assert.equal(s!.discountCents, 900);
  assert.equal(s!.times, 2);
  assert.equal(s!.addMore, 1);
});

test('a percentage instead of free, and nothing without units', () => {
  const half = { ...offer, percentOff: 50 };
  assert.equal(multiBuySavings(new Map([['a', [999, 999, 999]]]), [half])[0]!.discountCents, 500);
  assert.deepEqual(multiBuySavings(new Map([['c', [100]]]), [offer]), []);
  assert.equal(multiBuySavings(new Map([['a', [100]]]), [offer])[0]!.addMore, 0);
});

test('terms and checks', () => {
  assert.equal(multiBuyText(offer), 'Buy 2, get 1 free');
  assert.equal(multiBuyText({ buyQty: 3, getQty: 1, percentOff: 50 }), 'Buy 3, get 1 50% off');
  const ok = { buyQty: 2, getQty: 1, percentOff: 100, productIds: [crypto.randomUUID()] };
  assert.ok(MultiBuyCreateSchema.safeParse(ok).success);
  assert.ok(!MultiBuyCreateSchema.safeParse({ ...ok, getQty: 3 }).success);
  assert.ok(!MultiBuyCreateSchema.safeParse({ ...ok, percentOff: 5 }).success);
});
