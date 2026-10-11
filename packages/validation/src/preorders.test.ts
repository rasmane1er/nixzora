import assert from 'node:assert/strict';
import { test } from 'node:test';
import { deliveryWindow } from './delivery';
import {
  deliveryFrom,
  easternToday,
  isPreorder,
  releaseDateProblem,
  releaseStart,
  twoDayFrom,
} from './preorders';

// Tuesday 3 November 2026, 10:00 Eastern.
const now = new Date('2026-11-03T15:00:00Z');

test('a pre-order until its release day, Eastern', () => {
  assert.equal(easternToday(now), '2026-11-03');
  assert.equal(isPreorder('2026-11-04', now), true);
  assert.equal(isPreorder('2026-11-03', now), false);
  assert.equal(isPreorder(null, now), false);
  // 23:30 Eastern on the 3rd is still the 3rd.
  assert.equal(isPreorder('2026-11-04', new Date('2026-11-04T04:30:00Z')), true);
});

test('release dates: after today, within 180 days', () => {
  assert.equal(releaseDateProblem('2026-11-04', now), null);
  assert.equal(releaseDateProblem('2026-11-03', now), 'NOT_FUTURE');
  assert.equal(releaseDateProblem('2027-06-01', now), 'TOO_FAR');
  assert.equal(releaseDateProblem('soon', now), 'INVALID');
});

test('delivery counts from the release day', () => {
  assert.deepEqual(
    deliveryFrom(1, '2026-11-20', now),
    deliveryWindow(releaseStart('2026-11-20'), 1),
  );
  // Friday 20 Nov ships that day; 2-day lands Monday 23 – Tuesday 24.
  assert.deepEqual(twoDayFrom('2026-11-20', now), { earliest: '2026-11-23', latest: '2026-11-24' });
  assert.deepEqual(deliveryFrom(1, null, now), deliveryWindow(now, 1));
});
