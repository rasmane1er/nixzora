import { csvCell, parseCsv } from '../../common/csv';
import { type ImportContext, parseMoney, parseSpecs, planImport } from './listing-import';

const ctx = (overrides: Partial<ImportContext> = {}): ImportContext => ({
  categories: new Map([['speakers', '0190a5e0-0000-7000-8000-000000000001']]),
  ownSkus: new Map(),
  takenSkus: new Set(),
  ...overrides,
});

const HEADER =
  'product,title,category,description,specs,sku,option,price,compare_at_price,stock,barcode';

describe('parseCsv', () => {
  it('handles quotes, embedded commas and newlines, CRLF and a byte-order mark', () => {
    const text = '﻿a,b,c\r\n"Hi, there","say ""yes""","line 1\nline 2"\r\n\r\n,,\n';
    expect(parseCsv(text)).toEqual([
      ['a', 'b', 'c'],
      ['Hi, there', 'say "yes"', 'line 1\nline 2'],
    ]);
  });

  it('rejects an unclosed quote', () => {
    expect(() => parseCsv('a,"b\n')).toThrow(/not closed/);
  });

  it('round-trips through csvCell', () => {
    const values = ['plain', 'a, b', 'quote "x"', 'two\nlines'];
    expect(parseCsv(values.map(csvCell).join(','))).toEqual([values]);
  });
});

describe('parseMoney and parseSpecs', () => {
  it('reads prices the way people type them', () => {
    expect(parseMoney('$1,249.50')).toBe(124950);
    expect(parseMoney('19')).toBe(1900);
    expect(parseMoney('')).toBeUndefined();
    expect(parseMoney('12.345')).toBeNaN();
    expect(parseMoney('free')).toBeNaN();
  });

  it('reads specs as name: value pairs', () => {
    expect(parseSpecs('Battery hours: 30; wireless: yes; color: Red')).toEqual({
      battery_hours: 30,
      wireless: true,
      color: 'Red',
    });
  });
});

describe('planImport', () => {
  it('groups options into listings and reports nothing to fix', () => {
    const plan = planImport(
      parseCsv(
        [
          HEADER,
          'amp,Tube amp,speakers,A warm 8W amplifier.,power_w: 8; tubes: EL84,AMP-BLK,Black,599,699,3,',
          'amp,,,,,AMP-WAL,Walnut,649,,2,',
          ',Speaker cable,speakers,Oxygen-free copper.,,CBL-2M,2 m,19.99,,40,',
        ].join('\n'),
      ),
      ctx(),
    );
    expect(plan.errors).toEqual([]);
    expect(plan.rows).toBe(3);
    expect(plan.creates).toHaveLength(2);
    expect(plan.creates[0]!.product).toMatchObject({
      title: 'Tube amp',
      attributes: { power_w: 8, tubes: 'EL84' },
      variants: [
        {
          sku: 'AMP-BLK',
          title: 'Black',
          priceCents: 59900,
          compareAtCents: 69900,
          initialStock: 3,
        },
        { sku: 'AMP-WAL', title: 'Walnut', priceCents: 64900, initialStock: 2 },
      ],
    });
    expect(plan.creates[0]!.rows).toEqual([2, 3]);
  });

  it('updates price and stock of SKUs the seller already lists, skipping unchanged rows', () => {
    const plan = planImport(parseCsv(`sku,price,stock\nAMP-BLK,549.00,10\nCBL-2M,,`), {
      ...ctx(),
      ownSkus: new Map([
        [
          'AMP-BLK',
          { variantId: 'v1', priceCents: 59900, compareAtCents: null, onHand: 3, reserved: 1 },
        ],
        [
          'CBL-2M',
          { variantId: 'v2', priceCents: 1999, compareAtCents: null, onHand: 40, reserved: 0 },
        ],
      ]),
    });
    expect(plan.errors).toEqual([]);
    expect(plan.creates).toEqual([]);
    expect(plan.updates).toEqual([
      {
        row: 2,
        sku: 'AMP-BLK',
        variantId: 'v1',
        priceCents: 54900,
        compareAtCents: undefined,
        stock: 10,
        stockDelta: 7,
      },
    ]);
  });

  it('reports every problem by row and column', () => {
    const plan = planImport(
      parseCsv(
        [
          HEADER,
          ',Amp,toasters,Desc,,AMP-1,,599,,1,', // unknown category
          ',Cable,speakers,Desc,,CBL-1,,abc,,1,', // bad price
          ',Cable 2,speakers,Desc,,CBL-1,,10,,1,', // duplicate SKU in the file
          ',Cable 3,speakers,Desc,,TAKEN-1,,10,,1,', // someone else's SKU
          ',,speakers,Desc,,NEW-1,,10,,1,', // no title
          ',Plug,speakers,Desc,,PLG-1,,10,5,1,', // "was" lower than price
          'held,,,,,HELD-1,,,,0,', // below the units held by checkouts
        ].join('\n'),
      ),
      {
        ...ctx(),
        takenSkus: new Set(['TAKEN-1']),
        ownSkus: new Map([
          [
            'HELD-1',
            { variantId: 'v9', priceCents: 100, compareAtCents: null, onHand: 5, reserved: 2 },
          ],
        ]),
      },
    );
    expect(plan.errors.map((e) => [e.row, e.column])).toEqual([
      [2, 'category'],
      [3, 'price'],
      [4, 'sku'],
      [5, 'sku'],
      [6, 'title'],
      [7, 'compare_at_price'],
      [8, 'stock'],
    ]);
    expect(plan.errors[0]!.message).toBe('Unknown category "toasters".');
  });

  it('refuses files without the required columns or with unknown ones', () => {
    expect(planImport(parseCsv('title,price\nX,1'), ctx()).errors[0]).toMatchObject({
      row: 1,
      column: 'sku',
    });
    expect(planImport(parseCsv('sku,price,colour\nX,1,red'), ctx()).errors[0]!.message).toMatch(
      /Unknown columns: colour/,
    );
  });
});
