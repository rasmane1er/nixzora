import assert from 'node:assert/strict';
import { test } from 'node:test';
import { arriveByChoices, maxHandlingDaysBy } from './arrive-by';
import { deliveryWindow } from './delivery';

const now = new Date('2026-10-12T14:00:00Z'); // Monday, 10:00 Eastern

test('three days to choose from, soonest first', () => {
  const days = arriveByChoices(now);
  assert.equal(days.length, 3);
  assert.deepEqual([...days].sort(), days);
  assert.equal(days[0], deliveryWindow(now, 1).latest);
});

test('the handling time that still makes it', () => {
  const [first, second] = arriveByChoices(now) as [string, string];
  assert.equal(maxHandlingDaysBy(first, now), 1);
  assert.equal(maxHandlingDaysBy(second, now), 2);
  assert.equal(maxHandlingDaysBy('2026-10-12', now), -1);
});
