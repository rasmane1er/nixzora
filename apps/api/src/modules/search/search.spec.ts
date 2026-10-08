import { buildSearchDocument, derivedTraits, specPhrases } from './search-documents';
import { reciprocalRankFusion } from './search-engine';

describe('search documents', () => {
  const product = {
    id: '00000000-0000-7000-8000-000000000001',
    title: 'Vela 13 Air ultralight laptop',
    description: 'Under a kilogram, fanless and silent.',
    attributes: { weight_kg: 0.98, battery_hours: 16, anc: false, os: 'Linux' },
    brand: { name: 'Vela' },
    category: { name: 'Laptops', parent: { name: 'Computers' } },
    variants: [{ title: '16GB / 512GB', sku: 'VELA13-16-512', options: { memory: '16GB' } }],
  };

  it('turns specs into words shoppers use', () => {
    expect(specPhrases(product.attributes)).toEqual(
      expect.arrayContaining(['0.98 kg weight', '16 hours battery life', 'operating system Linux']),
    );
    expect(derivedTraits(product.attributes)).toEqual(
      expect.arrayContaining(['lightweight portable for travel', 'long battery life all-day']),
    );
  });

  it('weights the title, keeps facets and SKUs searchable, and embeds everything', () => {
    const doc = buildSearchDocument(product);
    expect(doc.titleText).toBe('Vela 13 Air ultralight laptop Vela');
    expect(doc.facetsText).toContain('Computers');
    expect(doc.facetsText).toContain('VELA13-16-512');
    expect(doc.embeddingText).toContain('Good for: lightweight portable for travel');
  });
});

describe('reciprocal rank fusion', () => {
  it('ranks ids found by both retrievers first', () => {
    const fused = reciprocalRankFusion([
      ['a', 'b', 'c'],
      ['c', 'd', 'a'],
    ]);
    expect([...fused.keys()].slice(0, 2)).toEqual(['a', 'c']);
    expect(fused.size).toBe(4);
  });
});
