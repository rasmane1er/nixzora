import { z } from 'zod';

/**
 * Size & fit guide (p10-26). A size chart is a small table: a header row of measurements and one
 * row per size. Stores and NIXZORA staff write it as plain lines, one row per line, cells
 * separated by commas (or tabs, so a table pasted from a spreadsheet works):
 *
 *   Size, Chest (in), Chest (cm)
 *   S, 34–36, 86–91
 */
export const SIZE_CHART_MAX_ROWS = 30;
export const SIZE_CHART_MAX_COLUMNS = 8;

export const FIT_ANSWERS = ['SMALL', 'TRUE', 'LARGE'] as const;
export type FitAnswer = (typeof FIT_ANSWERS)[number];

/** Fewer answers than this and there is no fit verdict, only the counts. */
export const FIT_MIN_ANSWERS = 5;

export type SizeChartTable = { columns: string[]; rows: { size: string; values: string[] }[] };

export type SizeChartProblem =
  | { code: 'EMPTY' }
  | { code: 'NO_ROWS' }
  | { code: 'TOO_MANY_ROWS' }
  | { code: 'TOO_MANY_COLUMNS' }
  | { code: 'CELL_COUNT'; line: number }
  | { code: 'CELL_TOO_LONG'; line: number }
  | { code: 'DUPLICATE_SIZE'; size: string };

const cells = (line: string) =>
  (line.includes('\t') ? line.split('\t') : line.split(',')).map((cell) => cell.trim());

/** Reads the text form; every problem is reported with its line, so the form can say where. */
export function parseSizeChart(
  text: string,
): { ok: true; table: SizeChartTable } | { ok: false; problem: SizeChartProblem } {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { ok: false, problem: { code: 'EMPTY' } };
  const header = cells(lines[0]!);
  if (header.length < 2) return { ok: false, problem: { code: 'NO_ROWS' } };
  if (header.length - 1 > SIZE_CHART_MAX_COLUMNS) {
    return { ok: false, problem: { code: 'TOO_MANY_COLUMNS' } };
  }
  if (lines.length < 2) return { ok: false, problem: { code: 'NO_ROWS' } };
  if (lines.length - 1 > SIZE_CHART_MAX_ROWS) {
    return { ok: false, problem: { code: 'TOO_MANY_ROWS' } };
  }
  const seen = new Set<string>();
  const rows: SizeChartTable['rows'] = [];
  for (let i = 1; i < lines.length; i++) {
    const row = cells(lines[i]!);
    if (row.length !== header.length || !row[0]) {
      return { ok: false, problem: { code: 'CELL_COUNT', line: i + 1 } };
    }
    if (row.some((cell) => cell.length > 40)) {
      return { ok: false, problem: { code: 'CELL_TOO_LONG', line: i + 1 } };
    }
    const key = row[0].toUpperCase();
    if (seen.has(key)) return { ok: false, problem: { code: 'DUPLICATE_SIZE', size: row[0] } };
    seen.add(key);
    rows.push({ size: row[0], values: row.slice(1) });
  }
  if (header.some((cell) => !cell || cell.length > 40)) {
    return { ok: false, problem: { code: 'CELL_TOO_LONG', line: 1 } };
  }
  return { ok: true, table: { columns: header.slice(1), rows } };
}

/** The text form of a table, for editing. */
export function formatSizeChart(table: SizeChartTable, sizeLabel = 'Size'): string {
  return [
    [sizeLabel, ...table.columns].join(', '),
    ...table.rows.map((row) => [row.size, ...row.values].join(', ')),
  ].join('\n');
}

export const SizeChartSaveSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    categoryId: z.uuid(),
    text: z.string().max(5000),
    note: z
      .string()
      .trim()
      .max(300)
      .optional()
      .transform((v) => v || undefined),
    /** Staff only: the chart shown on this category's products that have none of their own. */
    isDefault: z.boolean().optional(),
  })
  .superRefine((value, ctx) => {
    const parsed = parseSizeChart(value.text);
    if (!parsed.ok) {
      ctx.addIssue({
        code: 'custom',
        path: ['text'],
        message: SIZE_CHART_PROBLEM_TEXT(parsed.problem),
      });
    }
  });
export type SizeChartSave = z.infer<typeof SizeChartSaveSchema>;

/** English messages for the API; the web and app show their own translation of each code. */
export function SIZE_CHART_PROBLEM_TEXT(problem: SizeChartProblem): string {
  switch (problem.code) {
    case 'EMPTY':
      return 'Write the chart: a header line, then one line per size.';
    case 'NO_ROWS':
      return 'Add at least one measurement column and one size.';
    case 'TOO_MANY_ROWS':
      return `A chart can have up to ${SIZE_CHART_MAX_ROWS} sizes.`;
    case 'TOO_MANY_COLUMNS':
      return `A chart can have up to ${SIZE_CHART_MAX_COLUMNS} measurements.`;
    case 'CELL_COUNT':
      return `Line ${problem.line} doesn't have the same number of cells as the header.`;
    case 'CELL_TOO_LONG':
      return `A cell on line ${problem.line} is longer than 40 characters.`;
    case 'DUPLICATE_SIZE':
      return `The size "${problem.size}" is in the chart twice.`;
  }
}

export type SizeChartView = SizeChartTable & {
  id: string;
  name: string;
  note: string | null;
  categoryId: string;
  categoryName: string;
  /** NIXZORA's chart (no store). */
  nixzora: boolean;
  isDefault: boolean;
  /** Listings using it. */
  productCount: number;
  updatedAt: string;
};

/** What a shopper sees on a clothing or shoe page. */
export type ProductSizeGuide = {
  chart: (SizeChartTable & { name: string; note: string | null }) | null;
  fit: {
    answers: number;
    small: number;
    trueToSize: number;
    large: number;
    /** null below FIT_MIN_ANSWERS answers, or when no answer has half of them. */
    verdict: FitAnswer | null;
  };
};
