import assert from 'node:assert/strict';
import { test } from 'node:test';
import { warrantyParts, warrantyStatus, warrantyUntil } from './warranty';

test('cover ends the day before the same date, months later', () => {
  assert.equal(warrantyUntil('2026-10-20', 12), '2027-10-19');
  assert.equal(warrantyUntil('2026-10-20', 24), '2028-10-19');
  assert.equal(warrantyUntil('2026-01-31', 1), '2026-02-27');
  assert.equal(warrantyUntil('2026-11-15', 3), '2027-02-14');
});

test('status: active, ending within three weeks, ended', () => {
  const now = new Date('2026-11-03T17:00:00Z');
  assert.equal(warrantyStatus('2027-11-03', now), 'ACTIVE');
  assert.equal(warrantyStatus('2026-11-20', now), 'ENDING_SOON');
  assert.equal(warrantyStatus('2026-11-03', now), 'ENDING_SOON');
  assert.equal(warrantyStatus('2026-11-02', now), 'ENDED');
});

test('years when whole', () => {
  assert.deepEqual(warrantyParts(24), { years: 2 });
  assert.deepEqual(warrantyParts(6), { months: 6 });
});
