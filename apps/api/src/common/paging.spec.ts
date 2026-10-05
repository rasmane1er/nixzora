import { pagedResult, totalPages } from '@nixzora/validation';

describe('paging (shared by every list endpoint)', () => {
  it('counts pages, with one page for an empty list', () => {
    expect(totalPages(0, 25)).toBe(1);
    expect(totalPages(25, 25)).toBe(1);
    expect(totalPages(26, 25)).toBe(2);
  });

  it('builds the page object every list returns', () => {
    expect(pagedResult(['a', 'b'], 52, { page: 3, pageSize: 25 })).toEqual({
      items: ['a', 'b'],
      page: 3,
      pageSize: 25,
      total: 52,
      totalPages: 3,
    });
  });
});
