'use client';

import {
  parseSizeChart,
  SIZE_CHART_MAX_COLUMNS,
  SIZE_CHART_MAX_ROWS,
  type SizeChartProblem,
} from '@nixzora/validation';
import { useState } from 'react';
import { useT } from '@/components/I18nProvider';

type Option = { id: string; label: string };

/**
 * One size chart's form (p10-26): name, category, the chart as text with a live preview and the
 * problem (with its line) before saving, and a note for shoppers.
 */
export function SizeChartForm({
  action,
  categories,
  initial,
  showDefault = false,
}: {
  action: (form: FormData) => Promise<void>;
  categories: Option[];
  initial?: {
    id: string;
    name: string;
    categoryId: string;
    text: string;
    note: string | null;
    isDefault?: boolean;
  };
  /** Ops Center: choose the category's default. */
  showDefault?: boolean;
}) {
  const t = useT('sizeGuide');
  const [text, setText] = useState(
    initial?.text ?? `${t('size')}, Chest (in), Chest (cm)\nS, 34–36, 86–91\nM, 38–40, 97–102`,
  );
  const parsed = parseSizeChart(text);
  const problem = (p: SizeChartProblem): string => {
    switch (p.code) {
      case 'CELL_COUNT':
      case 'CELL_TOO_LONG':
        return t(`problem_${p.code}`, { line: p.line });
      case 'DUPLICATE_SIZE':
        return t('problem_DUPLICATE_SIZE', { size: p.size });
      case 'TOO_MANY_ROWS':
        return t('problem_TOO_MANY_ROWS', { max: SIZE_CHART_MAX_ROWS });
      case 'TOO_MANY_COLUMNS':
        return t('problem_TOO_MANY_COLUMNS', { max: SIZE_CHART_MAX_COLUMNS });
      default:
        return t(`problem_${p.code}`);
    }
  };
  return (
    <form action={action} className="form size-chart-form">
      {initial ? <input type="hidden" name="id" value={initial.id} /> : null}
      <label>
        {t('name')}
        <input name="name" required minLength={2} maxLength={80} defaultValue={initial?.name} />
      </label>
      <label>
        {t('category')}
        <select name="categoryId" defaultValue={initial?.categoryId} required>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('chart')} <span className="hint">{t('chartHint')}</span>
        <textarea
          name="text"
          rows={8}
          className="mono"
          value={text}
          onChange={(event) => setText(event.target.value)}
          aria-invalid={!parsed.ok}
          aria-describedby="size-chart-status"
        />
      </label>
      <div id="size-chart-status" aria-live="polite">
        {parsed.ok ? (
          <div className="stack" style={{ gap: 6 }}>
            <span className="hint">{t('preview')}</span>
            <div className="table-scroll">
              <table className="plain size-table">
                <thead>
                  <tr>
                    <th scope="col">{t('size')}</th>
                    {parsed.table.columns.map((c) => (
                      <th key={c} scope="col">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.table.rows.map((row) => (
                    <tr key={row.size}>
                      <th scope="row">{row.size}</th>
                      {row.values.map((v, i) => (
                        <td key={i}>{v}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <p className="field-error" style={{ margin: 0 }}>
            {problem(parsed.problem)}
          </p>
        )}
      </div>
      <label>
        {t('note')}
        <input name="note" maxLength={300} defaultValue={initial?.note ?? ''} />
      </label>
      {showDefault ? (
        <label className="check">
          <input type="checkbox" name="isDefault" defaultChecked={initial?.isDefault} />{' '}
          {t('isDefault')}
        </label>
      ) : null}
      <div>
        <button className="btn btn--primary" type="submit" disabled={!parsed.ok}>
          {t('save')}
        </button>
      </div>
    </form>
  );
}
