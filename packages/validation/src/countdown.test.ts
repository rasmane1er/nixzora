import assert from 'node:assert/strict';
import { test } from 'node:test';
import { clockText, countdownPhase, durationText, orderCutoff } from './countdown';

test('a date until the last day, then a countdown, then ending soon', () => {
  const now = 0;
  const hour = 3_600_000;
  assert.equal(countdownPhase(30 * hour, now), 'later');
  assert.equal(countdownPhase(24 * hour, now), 'counting');
  assert.equal(countdownPhase(hour, now), 'soon');
  assert.equal(countdownPhase(0, now), 'ended');
});

test('clock and words', () => {
  assert.equal(clockText(3 * 3_600_000 + 7 * 60_000 + 15_000), '3:07:15');
  assert.equal(clockText(-1), '0:00:00');
  assert.equal(durationText(2 * 3_600_000 + 15 * 60_000 + 59_000), '2 h 15 min');
  assert.equal(durationText(3 * 3_600_000), '3 h');
  assert.equal(durationText(42 * 60_000), '42 min');
  assert.equal(durationText(30_000), '<1 min');
});

test('the order cutoff is 2 pm Eastern on the next business day', () => {
  // Monday 10:00 EDT: today at 2 pm.
  assert.equal(
    orderCutoff(new Date('2026-10-12T14:00:00Z')).toISOString(),
    '2026-10-12T18:00:00.000Z',
  );
  // Monday 3 pm: Tuesday.
  assert.equal(
    orderCutoff(new Date('2026-10-12T19:00:00Z')).toISOString(),
    '2026-10-13T18:00:00.000Z',
  );
  // Friday 4 pm: Monday.
  assert.equal(
    orderCutoff(new Date('2026-10-16T20:00:00Z')).toISOString(),
    '2026-10-19T18:00:00.000Z',
  );
  // Winter (EST): 2 pm is 19:00 UTC.
  assert.equal(
    orderCutoff(new Date('2026-12-07T15:00:00Z')).toISOString(),
    '2026-12-07T19:00:00.000Z',
  );
});
