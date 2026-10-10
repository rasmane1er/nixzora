import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatSizeChart, parseSizeChart, SizeChartSaveSchema } from './size-guide';

const text = 'Size, Chest (in), Chest (cm)\nS, 34–36, 86–91\nM, 38–40, 97–102';

test('a chart reads as a header and one row per size, commas or tabs', () => {
  const parsed = parseSizeChart(text);
  assert.ok(parsed.ok);
  assert.deepEqual(parsed.table, {
    columns: ['Chest (in)', 'Chest (cm)'],
    rows: [
      { size: 'S', values: ['34–36', '86–91'] },
      { size: 'M', values: ['38–40', '97–102'] },
    ],
  });
  assert.equal(
    formatSizeChart(parsed.table),
    'Size, Chest (in), Chest (cm)\nS, 34–36, 86–91\nM, 38–40, 97–102',
  );
  const pasted = parseSizeChart('Size\tFoot (cm)\n8\t26');
  assert.ok(pasted.ok && pasted.table.rows[0]!.values[0] === '26');
});

test('mistakes say where they are', () => {
  assert.deepEqual(parseSizeChart('  '), { ok: false, problem: { code: 'EMPTY' } });
  assert.deepEqual(parseSizeChart('Size, Chest\nS, 34, 86'), {
    ok: false,
    problem: { code: 'CELL_COUNT', line: 2 },
  });
  assert.deepEqual(parseSizeChart('Size, Chest\nS, 34\ns, 35'), {
    ok: false,
    problem: { code: 'DUPLICATE_SIZE', size: 's' },
  });
  const bad = SizeChartSaveSchema.safeParse({
    name: 'Tees',
    categoryId: '01a11d09-f805-740f-8c0f-e601b0148682',
    text: 'Size, Chest\nS',
  });
  assert.equal(bad.success, false);
});
