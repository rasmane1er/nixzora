import assert from 'node:assert/strict';
import { test } from 'node:test';
import { colorSwatch, photosForColor, productColors, twoToneSwatches } from './colors';

test('colors come from the active variants, in order, once each', () => {
  assert.deepEqual(
    productColors([
      { options: { color: 'Sage', size: 'S' } },
      { options: { color: 'Black', size: 'S' } },
      { options: { color: 'Sage', size: 'M' } },
      { options: { color: 'Red', size: 'M' }, isActive: false },
      { options: { size: 'L' } },
    ]),
    ['Sage', 'Black'],
  );
});

test("a color shows its own photos, then the general ones; others' are left out", () => {
  const photos = [
    { id: 'a', color: null },
    { id: 'b', color: 'Black' },
    { id: 'c', color: 'Sage' },
    { id: 'd', color: 'Sage' },
  ];
  assert.deepEqual(
    photosForColor(photos, 'Sage').map((p) => p.id),
    ['c', 'd', 'a'],
  );
  // No photos of its own, or no color chosen: everything.
  assert.equal(photosForColor(photos, 'Navy').length, 4);
  assert.equal(photosForColor(photos, null).length, 4);
});

test('swatches from the last known word, or none', () => {
  assert.equal(colorSwatch('Sage'), '#9cae93');
  assert.equal(colorSwatch('Heather Grey'), '#8a8f98');
  assert.equal(colorSwatch('Midnight navy'), '#1f2f4f');
  assert.equal(colorSwatch('Cosmic Latte'), null);
});

test('two-tone colors get both halves', () => {
  assert.deepEqual(twoToneSwatches('Navy / Orange'), ['#1f2f4f', '#e8622c']);
  assert.deepEqual(twoToneSwatches('Walnut & Linen'), ['#5d4030', '#e9e0cf']);
  assert.equal(twoToneSwatches('Navy'), null);
  assert.equal(twoToneSwatches('Navy / Unobtanium'), null);
});
