import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMoney, MoneySchema } from './money';

test('formatMoney renders cents as a currency string', () => {
  assert.equal(formatMoney({ amountCents: 134900, currency: 'USD' }), '$1,349.00');
});

test('MoneySchema rejects fractional cents', () => {
  assert.equal(MoneySchema.safeParse({ amountCents: 10.5, currency: 'USD' }).success, false);
});
