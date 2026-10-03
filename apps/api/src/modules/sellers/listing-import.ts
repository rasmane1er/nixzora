import {
  LISTING_IMPORT_COLUMNS,
  type ListingImportIssue,
  type SellerProductCreate,
  SellerProductCreateSchema,
  VariantUpdateSchema,
} from '@nixzora/validation';

/**
 * Bulk listing import (p7-03): turns a seller's CSV into new drafts and price/stock updates.
 * Pure, so every rule is unit-tested; the service supplies what's in the database.
 *
 * - One row per option (SKU). Rows with the same `product` (or, if blank, the same `title`) are
 *   options of one listing; the first row of a listing carries its title, category, description
 *   and specs.
 * - A SKU already in the seller's catalog updates that option's price, "was" price and stock.
 * - Nothing is saved while any row has an error.
 */

export const MAX_ROWS = 2000;

export type ExistingOption = {
  variantId: string;
  priceCents: number;
  compareAtCents: number | null;
  onHand: number;
  reserved: number;
};

export type ImportContext = {
  /** Active categories by slug. */
  categories: Map<string, string>;
  /** The seller's own options by SKU (upper case). */
  ownSkus: Map<string, ExistingOption>;
  /** SKUs (upper case) used by other sellers or NIXZORA. */
  takenSkus: Set<string>;
};

export type PlannedCreate = { product: SellerProductCreate; rows: number[] };
export type PlannedUpdate = {
  row: number;
  sku: string;
  variantId: string;
  priceCents?: number;
  compareAtCents?: number | null;
  /** Units on hand after the import. */
  stock?: number;
  stockDelta: number;
};

export type ImportPlan = {
  rows: number;
  creates: PlannedCreate[];
  updates: PlannedUpdate[];
  errors: ListingImportIssue[];
};

type Column = (typeof LISTING_IMPORT_COLUMNS)[number];
type Row = { n: number; get: (column: Column) => string };

/** "$1,249.00" → 124900; blank → undefined; anything else → NaN (reported as an error). */
export function parseMoney(value: string): number | undefined {
  const raw = value.replace(/[$,\s]/g, '');
  if (!raw) return undefined;
  return /^\d+(\.\d{1,2})?$/.test(raw) ? Math.round(Number(raw) * 100) : Number.NaN;
}

/** "battery_hours: 30; wireless: yes" → { battery_hours: 30, wireless: true }. */
export function parseSpecs(value: string): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const pair of value.split(/[;\n]/)) {
    const match = /^\s*([^:]+?)\s*:\s*(.+?)\s*$/.exec(pair);
    if (!match) continue;
    const key = match[1]!
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const text = match[2]!;
    if (!key) continue;
    out[key] = /^-?\d+(\.\d+)?$/.test(text)
      ? Number(text)
      : /^(yes|true)$/i.test(text)
        ? true
        : /^(no|false)$/i.test(text)
          ? false
          : text;
  }
  return out;
}

const PRODUCT_FIELD: Record<string, Column> = {
  title: 'title',
  description: 'description',
  categoryId: 'category',
  attributes: 'specs',
};
const VARIANT_FIELD: Record<string, Column> = {
  sku: 'sku',
  title: 'option',
  priceCents: 'price',
  compareAtCents: 'compare_at_price',
  initialStock: 'stock',
  barcode: 'barcode',
};

export function planImport(table: string[][], ctx: ImportContext): ImportPlan {
  const errors: ListingImportIssue[] = [];
  const plan: ImportPlan = { rows: 0, creates: [], updates: [], errors };
  const [header, ...body] = table;
  if (!header) {
    errors.push({ row: 1, message: 'The file is empty.' });
    return plan;
  }
  const names = header.map((name) => name.trim().toLowerCase().replace(/\s+/g, '_'));
  const index = new Map<string, number>();
  names.forEach((name, i) => index.set(name, i));
  for (const required of ['sku', 'price'] as const) {
    if (!index.has(required)) errors.push({ row: 1, column: required, message: 'Column missing.' });
  }
  const unknown = names.filter(
    (name) => name && !(LISTING_IMPORT_COLUMNS as readonly string[]).includes(name),
  );
  if (unknown.length) {
    errors.push({ row: 1, message: `Unknown columns: ${unknown.join(', ')}. Use the template.` });
  }
  if (body.length > MAX_ROWS) {
    errors.push({ row: MAX_ROWS + 2, message: `Up to ${MAX_ROWS} rows per file.` });
  }
  if (errors.length) return plan;

  const rows: Row[] = body.map((cells, i) => ({
    n: i + 2, // spreadsheet row number: the header is row 1
    get: (column) => (cells[index.get(column) ?? -1] ?? '').trim(),
  }));
  plan.rows = rows.length;

  const seen = new Set<string>();
  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    const sku = row.get('sku').toUpperCase();
    if (!sku) {
      errors.push({ row: row.n, column: 'sku', message: 'Every row needs a SKU.' });
      continue;
    }
    if (seen.has(sku)) {
      errors.push({ row: row.n, column: 'sku', message: `SKU ${sku} appears twice in the file.` });
      continue;
    }
    seen.add(sku);

    const existing = ctx.ownSkus.get(sku);
    if (existing) {
      plan.updates.push(...planUpdate(row, sku, existing, errors));
      continue;
    }
    if (ctx.takenSkus.has(sku)) {
      errors.push({
        row: row.n,
        column: 'sku',
        message: `SKU ${sku} is already used by another listing.`,
      });
      continue;
    }
    const key = (row.get('product') || row.get('title')).toLowerCase();
    if (!key) {
      errors.push({ row: row.n, column: 'title', message: 'New products need a title.' });
      continue;
    }
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  for (const group of groups.values()) {
    const first = group[0]!;
    const pick = (column: Column) => group.map((row) => row.get(column)).find(Boolean) ?? '';
    const slug = pick('category').toLowerCase();
    const categoryId = ctx.categories.get(slug);
    if (!categoryId) {
      errors.push({
        row: first.n,
        column: 'category',
        message: slug ? `Unknown category "${slug}".` : 'New products need a category.',
      });
      continue;
    }
    const candidate = {
      title: pick('title'),
      description: pick('description'),
      categoryId,
      attributes: parseSpecs(pick('specs')),
      variants: group.map((row) => ({
        sku: row.get('sku'),
        title: row.get('option') || 'Standard',
        priceCents: parseMoney(row.get('price')),
        compareAtCents: parseMoney(row.get('compare_at_price')) ?? null,
        initialStock: row.get('stock') === '' ? 0 : Number(row.get('stock')),
        barcode: row.get('barcode') || null,
      })),
    };
    const parsed = SellerProductCreateSchema.safeParse(candidate);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        const [head, i, field] = issue.path;
        if (head === 'variants' && typeof i === 'number') {
          errors.push({
            row: group[i]!.n,
            column: VARIANT_FIELD[String(field)] ?? undefined,
            message: friendly(issue.message, String(field)),
          });
        } else {
          errors.push({
            row: first.n,
            column: PRODUCT_FIELD[String(head)] ?? undefined,
            message: friendly(issue.message, String(head)),
          });
        }
      }
      continue;
    }
    plan.creates.push({ product: parsed.data, rows: group.map((row) => row.n) });
  }

  errors.sort((a, b) => a.row - b.row);
  return plan;
}

function planUpdate(
  row: Row,
  sku: string,
  existing: ExistingOption,
  errors: ListingImportIssue[],
): PlannedUpdate[] {
  const before = errors.length;
  const price = parseMoney(row.get('price'));
  const compareAt = parseMoney(row.get('compare_at_price'));
  const prices = VariantUpdateSchema.safeParse({
    ...(price !== undefined ? { priceCents: price } : {}),
    ...(row.get('compare_at_price') !== '' ? { compareAtCents: compareAt } : {}),
  });
  if (!prices.success) {
    for (const issue of prices.error.issues) {
      const field = String(issue.path[0]);
      errors.push({
        row: row.n,
        column: VARIANT_FIELD[field],
        message: friendly(issue.message, field),
      });
    }
  } else if (
    prices.data.priceCents !== undefined &&
    prices.data.compareAtCents != null &&
    prices.data.compareAtCents <= prices.data.priceCents
  ) {
    errors.push({
      row: row.n,
      column: 'compare_at_price',
      message: 'The "was" price must be higher than the price.',
    });
  }
  let stock: number | undefined;
  if (row.get('stock') !== '') {
    stock = Number(row.get('stock'));
    if (!Number.isInteger(stock) || stock < 0 || stock > 1_000_000) {
      errors.push({ row: row.n, column: 'stock', message: 'Stock is a whole number, 0 or more.' });
    } else if (stock < existing.reserved) {
      errors.push({
        row: row.n,
        column: 'stock',
        message: `${existing.reserved} units are held by open checkouts; stock can't go below that.`,
      });
    }
  }
  if (errors.length > before || !prices.success) return [];
  // Only real changes: re-uploading an unchanged export does nothing.
  const priceCents =
    prices.data.priceCents !== existing.priceCents ? prices.data.priceCents : undefined;
  const compareAtCents =
    prices.data.compareAtCents !== undefined &&
    prices.data.compareAtCents !== existing.compareAtCents
      ? prices.data.compareAtCents
      : undefined;
  const stockDelta = stock === undefined ? 0 : stock - existing.onHand;
  if (priceCents === undefined && compareAtCents === undefined && stockDelta === 0) return [];
  return [
    {
      row: row.n,
      sku,
      variantId: existing.variantId,
      priceCents,
      compareAtCents,
      stock,
      stockDelta,
    },
  ];
}

/** Zod's messages, made about the spreadsheet rather than the API. */
function friendly(message: string, field: string): string {
  if (/expected number, received (nan|undefined)/i.test(message) || /received NaN/i.test(message)) {
    return field === 'initialStock'
      ? 'Stock is a whole number, 0 or more.'
      : 'Enter a price like 249.99.';
  }
  if (/expected string, received undefined|too small/i.test(message) && field === 'title') {
    return 'New products need a title.';
  }
  if (/too small/i.test(message) && field === 'description') {
    return 'New products need a description.';
  }
  return message;
}
