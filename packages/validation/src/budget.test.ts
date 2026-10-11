import assert from 'node:assert/strict';
import { test } from 'node:test';
import { budgetCheck, easternDayStart, easternMonth } from './budget';

test('Eastern days start at local midnight, summer and winter', () => {
  assert.equal(easternDayStart('2026-07-01').toISOString(), '2026-07-01T04:00:00.000Z');
  assert.equal(easternDayStart('2026-12-01').toISOString(), '2026-12-01T05:00:00.000Z');
});

test('the month is the Eastern one', () => {
  // 02:00 UTC on Nov 1 is still October 31 in New York.
  assert.equal(easternMonth(new Date('2026-11-01T02:00:00Z')).month, '2026-10');
  assert.equal(easternMonth(new Date('2026-11-01T06:00:00Z')).month, '2026-11');
});

test('warns when an order would go over, never otherwise', () => {
  const budget = { monthlyCents: 50_000, spentCents: 40_000, leftCents: 10_000, month: '2026-11' };
  assert.deepEqual(budgetCheck(budget, 4_000), { kind: 'within', leftAfterCents: 6_000 });
  assert.deepEqual(budgetCheck(budget, 12_500), { kind: 'over', overCents: 2_500 });
  assert.deepEqual(budgetCheck({ ...budget, monthlyCents: null }, 99_999), { kind: 'none' });
  assert.deepEqual(budgetCheck(null, 1), { kind: 'none' });
});
