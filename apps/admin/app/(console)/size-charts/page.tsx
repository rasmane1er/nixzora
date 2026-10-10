import { type Translate } from '@nixzora/i18n';
import { formatSizeChart, type SizeChartView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { api } from '@/lib/api';
import { catalogOptions } from '@/lib/catalog';
import { param, type SearchParams } from '@/lib/format';
import { getT } from '@/lib/i18n';
import { deleteSizeChart, saveSizeChart } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sizeGuide');
  return { title: t('navTitle') };
}

type Option = { id: string; label: string };

/** NIXZORA's size charts (p10-26): the default chart is shown on a category's sized products. */
export default async function SizeChartsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [charts, { categories }, t, tc] = await Promise.all([
    api<SizeChartView[]>('/admin/size-charts'),
    catalogOptions(),
    getT('sizeGuide'),
    getT('common'),
  ]);
  const options = categories.map((c) => ({ id: c.id, label: c.label }));

  return (
    <>
      <PageHeader eyebrow={t('nixzora')} title={t('navTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ maxWidth: 720 }}>
        {t('leadOps')}
      </p>

      <div className="two-col">
        <section className="card">
          <h2>{t('nixzora')}</h2>
          {charts.length === 0 ? (
            <Empty>{t('none')}</Empty>
          ) : (
            charts.map((chart) => (
              <details key={chart.id} className="size-chart">
                <summary>
                  <strong>{chart.name}</strong>{' '}
                  <span className="muted">
                    {chart.categoryName} · {t('used', { count: chart.productCount })}
                  </span>{' '}
                  {chart.isDefault ? (
                    <span className="pill pill--active">{t('defaultBadge')}</span>
                  ) : null}
                </summary>
                <ChartForm t={t} options={options} chart={chart} />
                <ActionButton
                  action={deleteSizeChart}
                  label={tc('delete')}
                  tone="danger"
                  fields={{ id: chart.id }}
                />{' '}
                <span className="hint">{t('deleteHint')}</span>
              </details>
            ))
          )}
        </section>

        <section className="card">
          <h2>{t('newChart')}</h2>
          <ChartForm t={t} options={options} />
        </section>
      </div>
    </>
  );
}

function ChartForm({
  t,
  options,
  chart,
}: {
  t: Translate<'sizeGuide'>;
  options: Option[];
  chart?: SizeChartView;
}) {
  return (
    <form action={saveSizeChart} className="form">
      {chart ? <input type="hidden" name="id" value={chart.id} /> : null}
      <label>
        {t('name')}
        <input name="name" required minLength={2} maxLength={80} defaultValue={chart?.name} />
      </label>
      <label>
        {t('category')}
        <select name="categoryId" required defaultValue={chart?.categoryId ?? ''}>
          <option value="" disabled>
            —
          </option>
          {options.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('chart')} <span className="hint">{t('chartHint')}</span>
        <textarea
          name="text"
          required
          rows={8}
          maxLength={5000}
          spellCheck={false}
          className="mono"
          defaultValue={chart ? formatSizeChart(chart, t('size')) : ''}
          placeholder={'Size, Chest (in), Waist (in)\nS, 34-36, 28-30\nM, 38-40, 32-34'}
        />
      </label>
      <label>
        {t('note')}
        <input name="note" maxLength={300} defaultValue={chart?.note ?? ''} />
      </label>
      <label className="check">
        <input type="checkbox" name="isDefault" defaultChecked={chart?.isDefault} />{' '}
        {t('isDefault')}
      </label>
      <div>
        <SubmitButton>{t('save')}</SubmitButton>
      </div>
    </form>
  );
}
