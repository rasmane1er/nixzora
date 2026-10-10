import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addBusinessDays, deliveryWindow, twoDayWindow } from './delivery';

test('skips weekends and fixed holidays', () => {
  assert.equal(addBusinessDays('2026-10-09', 1), '2026-10-12'); // Fri → Mon
  assert.equal(addBusinessDays('2026-12-24', 1), '2026-12-28'); // Thu → (Christmas, weekend) Mon
  assert.equal(addBusinessDays('2026-10-10', 0), '2026-10-12'); // Sat → Mon
});

test('orders before 2 pm Eastern start the same business day', () => {
  // Tue 13 Oct 2026, 10:00 Eastern (14:00 UTC): ships Wed (1 day), arrives Fri – Wed.
  assert.deepEqual(deliveryWindow(new Date('2026-10-13T14:00:00Z'), 1), {
    earliest: '2026-10-16',
    latest: '2026-10-21',
  });
  // Same day at 3 pm Eastern: one business day later.
  assert.deepEqual(deliveryWindow(new Date('2026-10-13T19:00:00Z'), 1), {
    earliest: '2026-10-19',
    latest: '2026-10-22',
  });
});

test('Plus 2-day delivery: out the same business day before the cutoff, there within 2', () => {
  // Tuesday 10:00 Eastern → ships Tuesday → Wednesday to Thursday.
  assert.deepEqual(twoDayWindow(new Date('2026-10-13T14:00:00Z')), {
    earliest: '2026-10-14',
    latest: '2026-10-15',
  });
  // Friday 4 pm Eastern → ships Monday → Tuesday to Wednesday.
  assert.deepEqual(twoDayWindow(new Date('2026-10-16T20:00:00Z')), {
    earliest: '2026-10-20',
    latest: '2026-10-21',
  });
});
