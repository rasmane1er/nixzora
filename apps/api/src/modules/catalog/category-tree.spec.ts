import { ancestorsOf, descendantIds, MAX_CATEGORY_DEPTH } from './category-tree';

const rows = [
  { id: 'computers', parentId: null },
  { id: 'laptops', parentId: 'computers' },
  { id: 'gaming-laptops', parentId: 'laptops' },
  { id: 'desktops', parentId: 'computers' },
  { id: 'audio', parentId: null },
];
const byId = new Map(rows.map((row) => [row.id, row]));

describe('category tree', () => {
  it('lists parents nearest first', () => {
    expect(ancestorsOf('gaming-laptops', byId).map((row) => row.id)).toEqual([
      'laptops',
      'computers',
    ]);
    expect(ancestorsOf('audio', byId)).toEqual([]);
    expect(ancestorsOf('unknown', byId)).toEqual([]);
  });

  it('stops on a parent loop instead of spinning', () => {
    const loop = new Map([
      ['a', { id: 'a', parentId: 'b' }],
      ['b', { id: 'b', parentId: 'a' }],
    ]);
    expect(ancestorsOf('a', loop).map((row) => row.id)).toEqual(['b']);
    const chain = new Map(
      Array.from({ length: 50 }, (_, i) => [`c${i}`, { id: `c${i}`, parentId: `c${i + 1}` }]),
    );
    expect(ancestorsOf('c0', chain)).toHaveLength(MAX_CATEGORY_DEPTH);
  });

  it('collects a category and everything under it', () => {
    expect(descendantIds('computers', rows)).toEqual([
      'computers',
      'laptops',
      'desktops',
      'gaming-laptops',
    ]);
    expect(descendantIds('audio', rows)).toEqual(['audio']);
  });
});
