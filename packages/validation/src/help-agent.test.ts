import assert from 'node:assert/strict';
import { test } from 'node:test';
import { HelpActionSchema, HelpMessageCreateSchema } from './help-agent';

test('help messages are trimmed and bounded', () => {
  assert.equal(HelpMessageCreateSchema.parse({ text: '  where is it? ' }).text, 'where is it?');
  assert.equal(HelpMessageCreateSchema.safeParse({ text: '   ' }).success, false);
  assert.equal(HelpMessageCreateSchema.safeParse({ text: 'x'.repeat(1001) }).success, false);
});

test('help actions name a real order number', () => {
  const ok = HelpActionSchema.parse({ kind: 'cancel', orderNumber: 'nx-7kq4m2' });
  assert.deepEqual(ok, { kind: 'cancel', orderNumber: 'NX-7KQ4M2' });
  assert.equal(HelpActionSchema.safeParse({ kind: 'cancel', orderNumber: '42' }).success, false);
  assert.equal(
    HelpActionSchema.safeParse({ kind: 'choose', intent: 'HUMAN', orderNumber: 'NX-7KQ4M2' })
      .success,
    false,
  );
  assert.equal(HelpActionSchema.parse({ kind: 'handoff' }).kind, 'handoff');
});
