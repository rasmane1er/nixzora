import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dollarsToCents,
  SpendOfferCreateSchema,
  spendSavings,
  spendText,
  spendTierFor,
} from './spend-offers';

const tiers = [
  { minCents: 5000, offCents: 500 },
  { minCents: 10000, offCents: 1500 },
];
const offer = { id: 'o1', sellerId: 's1', tiers };

test('the highest tier reached applies, and the next one is a nudge', () => {
  const [s] = spendSavings(new Map([['s1', 7500]]), [offer]);
  assert.equal(s!.discountCents, 500);
  assert.deepEqual(s!.next, { minCents: 10000, offCents: 1500, moreCents: 2500 });
  const [top] = spendSavings(new Map([['s1', 12000]]), [offer]);
  assert.equal(top!.discountCents, 1500);
  assert.equal(top!.next, null);
});

test('below the first tier saves nothing but still shows how far it is', () => {
  const [s] = spendSavings(new Map([['s1', 2000]]), [offer]);
  assert.equal(s!.discountCents, 0);
  assert.equal(s!.next?.moreCents, 3000);
});

test('stores with nothing in the cart are left out; NIXZORA is keyed by ""', () => {
  assert.deepEqual(spendSavings(new Map([['other', 9000]]), [offer]), []);
  const [own] = spendSavings(new Map([['', 6000]]), [{ ...offer, sellerId: null }]);
  assert.equal(own!.discountCents, 500);
});

test('tiers must climb, and a saving is at most half the spend', () => {
  assert.ok(SpendOfferCreateSchema.safeParse({ tiers }).success);
  assert.ok(
    !SpendOfferCreateSchema.safeParse({
      tiers: [tiers[1], tiers[0]],
    }).success,
  );
  assert.ok(
    !SpendOfferCreateSchema.safeParse({ tiers: [{ minCents: 2000, offCents: 1500 }] }).success,
  );
  assert.ok(!SpendOfferCreateSchema.safeParse({ tiers: [] }).success);
});

test('helpers', () => {
  assert.equal(spendTierFor(tiers, 4999), null);
  assert.equal(spendTierFor(tiers, 10000)?.offCents, 1500);
  assert.equal(spendText(tiers), 'Spend $50, save $5; spend $100, save $15');
  assert.equal(dollarsToCents('49.99'), 4999);
  assert.ok(Number.isNaN(dollarsToCents('4,9')));
});
