import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PriceHistoryQuerySchema } from './history';

test('price history accepts 30, 90 or 365 days, 90 by default', () => {
  assert.equal(PriceHistoryQuerySchema.parse({}).days, 90);
  assert.equal(PriceHistoryQuerySchema.parse({ days: '365' }).days, 365);
  assert.equal(PriceHistoryQuerySchema.safeParse({ days: '7' }).success, false);
});
