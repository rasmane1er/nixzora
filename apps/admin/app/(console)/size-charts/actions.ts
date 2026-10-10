'use server';

import {
  parseSizeChart,
  SIZE_CHART_MAX_COLUMNS,
  SIZE_CHART_MAX_ROWS,
  type SizeChartProblem,
} from '@nixzora/validation';
import { FormProblem, api } from '@/lib/api';
import { checked, isUuid, perform, text, uuidField } from '@/lib/forms';
import { getT } from '@/lib/i18n';

const PATH = '/size-charts';

/** The chart's problem in the staff member's language. */
async function problemText(p: SizeChartProblem): Promise<string> {
  const t = await getT('sizeGuide');
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
}

/** Creates or saves one of NIXZORA's size charts (p10-26). */
export async function saveSizeChart(form: FormData): Promise<void> {
  const id = text(form, 'id');
  const chart = String(form.get('text') ?? '');
  const parsed = parseSizeChart(chart);
  const problem = parsed.ok ? null : await problemText(parsed.problem);
  const t = await getT('sizeGuide');
  await perform(
    PATH,
    async () => {
      if (problem) throw new FormProblem(problem);
      const body = {
        name: text(form, 'name') ?? '',
        categoryId: text(form, 'categoryId') ?? '',
        text: chart,
        note: text(form, 'note'),
        isDefault: checked(form, 'isDefault'),
      };
      return isUuid(id)
        ? api(`/admin/size-charts/${id}`, { method: 'PUT', body })
        : api('/admin/size-charts', { method: 'POST', body });
    },
    t('saved'),
  );
}

export async function deleteSizeChart(form: FormData): Promise<void> {
  const id = uuidField(form, 'id');
  const t = await getT('sizeGuide');
  await perform(PATH, () => api(`/admin/size-charts/${id}`, { method: 'DELETE' }), t('deleted'));
}
