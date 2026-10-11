import assert from 'node:assert/strict';
import { test } from 'node:test';
import { storeAway, vacationProblem } from './vacation';

// Noon Eastern on Nov 3, 2026.
const now = new Date('2026-11-03T17:00:00Z');

test('away from the first day until the day it is back', () => {
  const v = { from: '2026-11-03', until: '2026-11-10', message: 'Back soon' };
  assert.deepEqual(storeAway(v, now), { until: '2026-11-10', message: 'Back soon' });
  assert.equal(storeAway({ ...v, from: '2026-11-04' }, now), null);
  assert.equal(storeAway({ ...v, until: '2026-11-03' }, now), null);
  assert.deepEqual(storeAway({ from: '2026-11-01', until: null, message: null }, now), {
    until: null,
    message: null,
  });
  assert.equal(storeAway(null, now), null);
  assert.equal(storeAway({ from: null, until: null, message: null }, now), null);
});

test('dates must make sense', () => {
  assert.equal(vacationProblem({ from: '2026-11-03', until: '2026-11-20' }, now), null);
  assert.equal(vacationProblem({ from: '2026-11-03' }, now), null);
  assert.equal(vacationProblem({ from: '2026-11-02' }, now), 'PAST');
  assert.equal(vacationProblem({ from: '2026-11-05', until: '2026-11-05' }, now), 'ENDS_BEFORE');
  assert.equal(vacationProblem({ from: '2026-11-03', until: '2027-03-01' }, now), 'TOO_LONG');
  assert.equal(vacationProblem({ from: '2027-06-01' }, now), 'START_TOO_FAR');
  assert.equal(vacationProblem({ from: '2026-13-40' }, now), 'INVALID');
});
