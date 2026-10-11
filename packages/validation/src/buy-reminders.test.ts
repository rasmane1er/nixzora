import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buyReminderAt, buyReminderChoices, buyReminderProblem } from './buy-reminders';

test('choices: tomorrow, the coming Friday and the next payday', () => {
  // Monday, October 12 2026, midday Eastern.
  assert.deepEqual(buyReminderChoices(new Date('2026-10-12T16:00:00Z')), [
    { key: 'tomorrow', date: '2026-10-13' },
    { key: 'payday', date: '2026-10-15' },
    { key: 'friday', date: '2026-10-16' },
  ]);
  // Thursday the 29th: Friday is tomorrow, so a week on; payday is the 1st.
  assert.deepEqual(buyReminderChoices(new Date('2026-10-29T16:00:00Z')), [
    { key: 'tomorrow', date: '2026-10-30' },
    { key: 'payday', date: '2026-11-01' },
    { key: 'friday', date: '2026-11-06' },
  ]);
  // December 20: payday is January 1.
  assert.ok(
    buyReminderChoices(new Date('2026-12-20T16:00:00Z')).some((c) => c.date === '2027-01-01'),
  );
});

test('a date after today, within 90 days', () => {
  const now = new Date('2026-10-12T16:00:00Z');
  assert.ok(buyReminderProblem('2026-10-12', now));
  assert.equal(buyReminderProblem('2026-10-13', now), null);
  assert.ok(buyReminderProblem('2027-01-11', now));
});

test('reminders go out at 9:00 Eastern', () => {
  assert.equal(buyReminderAt('2026-10-16').toISOString(), '2026-10-16T13:00:00.000Z');
  assert.equal(buyReminderAt('2026-12-04').toISOString(), '2026-12-04T14:00:00.000Z');
});
