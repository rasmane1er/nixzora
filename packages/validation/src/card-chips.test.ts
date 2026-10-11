import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cardChips } from './card-chips';

test('card chips take known keys in order, skip false and long text', () => {
  assert.deepEqual(
    cardChips({
      weight_g: 290,
      anc: true,
      wireless: false,
      battery_hours: 40,
      material: 'A very long material description',
      resolution: '4K',
    }),
    [
      { key: 'anc', value: true },
      { key: 'battery_hours', value: 40 },
      { key: 'resolution', value: '4K' },
    ],
  );
  assert.deepEqual(cardChips(null), []);
});
