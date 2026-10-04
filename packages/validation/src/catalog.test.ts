import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ROLE_KEYS, RoleGrantSchema } from './admin';
import {
  BarcodeSchema,
  InventoryAdjustSchema,
  pagedResult,
  isValidGtin,
  ProductCreateSchema,
  ProductListQuerySchema,
  slugify,
  VariantCreateSchema,
} from './catalog';

test('slugify makes URL-safe slugs', () => {
  assert.equal(slugify('Kestrel 14 Pro (2027)!'), 'kestrel-14-pro-2027');
  assert.equal(slugify('  Café  Crème  '), 'cafe-creme');
  assert.equal(slugify('Arden\'s 27" Monitor'), 'ardens-27-monitor');
});

test('variant compare-at price must be above the price', () => {
  const base = { sku: 'kes-14-32', title: '32GB', priceCents: 134900 };
  assert.equal(VariantCreateSchema.safeParse({ ...base, compareAtCents: 149900 }).success, true);
  assert.equal(VariantCreateSchema.safeParse({ ...base, compareAtCents: 100 }).success, false);
  assert.equal(VariantCreateSchema.parse(base).sku, 'KES-14-32');
});

test('a product needs at least one variant and a category', () => {
  const result = ProductCreateSchema.safeParse({ title: 'Thing', description: 'x', variants: [] });
  assert.equal(result.success, false);
});

test('attribute names must be snake_case', () => {
  const ok = ProductCreateSchema.safeParse({
    title: 'Laptop',
    description: 'Fast',
    categoryId: '01900000-0000-7000-8000-000000000000',
    attributes: { 'RAM GB': 32 },
    variants: [{ sku: 'ABC-1', title: 'Base', priceCents: 100 }],
  });
  assert.equal(ok.success, false);
});

test('list query coerces strings from the URL', () => {
  const q = ProductListQuerySchema.parse({ page: '2', inStock: 'true', minPrice: '1000' });
  assert.deepEqual([q.page, q.inStock, q.minPrice, q.sort], [2, true, 1000, 'relevance']);
});

test('inventory adjustments cannot be zero', () => {
  assert.equal(InventoryAdjustSchema.safeParse({ delta: 0, reason: 'CORRECTION' }).success, false);
});

test('barcodes must carry a valid GS1 check digit', () => {
  assert.equal(isValidGtin('4006381333931'), true); // EAN-13
  assert.equal(isValidGtin('036000291452'), true); // UPC-A
  assert.equal(isValidGtin('96385074'), true); // EAN-8
  assert.equal(isValidGtin('4006381333932'), false);
  assert.equal(isValidGtin('12345'), false);
  assert.equal(BarcodeSchema.safeParse(' 036000291452 ').data, '036000291452');
});

test('pagedResult counts pages and keeps one page for an empty list', () => {
  assert.deepEqual(pagedResult(['a'], 51, { page: 2, pageSize: 25 }), {
    items: ['a'],
    page: 2,
    pageSize: 25,
    total: 51,
    totalPages: 3,
  });
  assert.equal(pagedResult([], 0, { page: 1, pageSize: 25 }).totalPages, 1);
});

test('role keys and the role grant schema agree', () => {
  for (const roleKey of ROLE_KEYS) assert.ok(RoleGrantSchema.safeParse({ roleKey }).success);
  assert.equal(RoleGrantSchema.safeParse({ roleKey: 'owner' }).success, false);
});
