import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { departmentLookup, quadsByCategory, rowShapes, spotlightDeal } from './card-shapes';
import type { ProductCard } from './catalog';
import type { SmartRow } from './recommendations';

const NOW = Date.parse('2026-10-13T12:00:00Z');
let n = 0;
function card(
  category: string,
  deal?: { endsInMin: number; plusOnly?: boolean },
  inStock = true,
): ProductCard {
  n += 1;
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    slug: `p${n}`,
    title: `Product ${n}`,
    brand: null,
    category: { slug: category, name: category },
    priceFromCents: 1000,
    compareAtCents: null,
    currency: 'USD',
    inStock,
    image: null,
    deal: deal
      ? {
          kind: 'LIGHTNING',
          percentOff: 20,
          endsAt: new Date(NOW + deal.endsInMin * 60_000).toISOString(),
          claimedPercent: 10,
          plusOnly: deal.plusOnly,
        }
      : undefined,
  };
}

describe('spotlightDeal', () => {
  it('picks the live deal ending soonest', () => {
    const later = card('a', { endsInMin: 300 });
    const soon = card('a', { endsInMin: 30 });
    assert.equal(spotlightDeal([later, soon], NOW)?.id, soon.id);
  });
  it('skips ended, sold-out and Plus-only deals', () => {
    const ended = card('a', { endsInMin: -5 });
    const soldOut = card('a', { endsInMin: 10 }, false);
    const plus = card('a', { endsInMin: 5, plusOnly: true });
    const open = card('a', { endsInMin: 600 });
    assert.equal(spotlightDeal([ended, soldOut, plus, open], NOW)?.id, open.id);
    assert.equal(spotlightDeal([ended, plus], NOW), null);
  });
});

describe('quadsByCategory', () => {
  it('keeps only full groups of four, in first-seen order, up to max', () => {
    const kitchen = [1, 2, 3, 4, 5].map(() => card('kitchen'));
    const audio = [1, 2, 3].map(() => card('audio'));
    const shoes = [1, 2, 3, 4].map(() => card('shoes'));
    const quads = quadsByCategory([...shoes, ...audio, ...kitchen], 5);
    assert.deepEqual(
      quads.map((q) => q.category.slug),
      ['shoes', 'kitchen'],
    );
    assert.equal(quads[1]!.products.length, 4);
    assert.equal(quadsByCategory([...shoes, ...kitchen], 1).length, 1);
  });
});

describe('departmentLookup', () => {
  it('groups leaf categories under their department', () => {
    const node = (slug: string, children: unknown[] = []) =>
      ({ id: slug, slug, name: slug.toUpperCase(), children }) as never;
    const of = departmentLookup([node('home', [node('kitchen'), node('decor', [node('rugs')])])]);
    assert.equal(of('rugs')?.slug, 'home');
    assert.equal(of('kitchen')?.name, 'HOME');
    const quads = quadsByCategory(
      [card('kitchen'), card('rugs'), card('kitchen'), card('decor')],
      1,
      of,
    );
    assert.equal(quads[0]?.category.slug, 'home');
  });
});

describe('rowShapes', () => {
  const row = (kind: SmartRow['kind']): SmartRow => ({
    kind,
    subject: 'x',
    source: 'search',
    products: [card('a')],
  });
  it('maps each signal to its shape and allows one Ask card', () => {
    const shapes = rowShapes([
      row('still_thinking'),
      row('interest'),
      row('interest'),
      row('restock'),
      row('saved_deals'),
      row('cart_addons'),
    ]).map((r) => r.shape);
    assert.deepEqual(shapes, ['quad', 'ask', 'rail', 'buyAgain', 'priceDrop', 'rail']);
  });
});
