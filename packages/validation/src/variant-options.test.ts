import assert from 'node:assert/strict';
import { test } from 'node:test';
import { optionAxes, optionState, pickVariant } from './variant-options';

const tee = ['Natural', 'Black'].flatMap((color) =>
  ['S', 'M', 'L'].map((size) => ({
    id: `${color}-${size}`,
    options: { size, color },
    available: color === 'Black' && size === 'L' ? 0 : 5,
  })),
);

test('clothing is chosen by color, then size', () => {
  assert.deepEqual(optionAxes(tee), [
    { name: 'color', values: ['Natural', 'Black'] },
    { name: 'size', values: ['S', 'M', 'L'] },
  ]);
});

test('a short list of laptop configurations stays a plain list', () => {
  const laptops = [
    { options: { memory: '16GB', storage: '512GB' }, available: 3 },
    { options: { memory: '32GB', storage: '1TB' }, available: 3 },
  ];
  assert.equal(optionAxes(laptops), null);
  assert.equal(optionAxes([{ options: { color: 'Red' }, available: 1 }]), null);
});

test('switching color keeps the size and says when a size is sold out', () => {
  const current = tee.find((v) => v.id === 'Natural-M')!;
  assert.equal(pickVariant(tee, current, 'color', 'Black').id, 'Black-M');
  const black = tee.find((v) => v.id === 'Black-M')!;
  assert.equal(optionState(tee, black, 'size', 'L'), 'soldOut');
  assert.equal(optionState(tee, black, 'size', 'S'), 'available');
  assert.equal(optionState(tee, black, 'size', 'XXL'), 'missing');
});
