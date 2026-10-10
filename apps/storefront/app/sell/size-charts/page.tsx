import { formatSizeChart, type SizeChartView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { categoryOptions, requireSeller } from '@/lib/sell';
import { deleteSizeChart, saveSizeChart } from './actions';
import { SizeChartForm } from './SizeChartForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sizeGuide');
  return { title: t('navTitle'), robots: { index: false } };
}

/** A store's size charts (p10-26), and NIXZORA's for reference. */
export default async function SizeChartsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/size-charts');
  const [charts, categories, t] = await Promise.all([
    api<SizeChartView[]>('/seller/size-charts'),
    categoryOptions(),
    getT('sizeGuide'),
  ]);
  const options = categories.map((c) => ({ id: c.id, label: c.label }));
  const mine = charts.filter((c) => !c.nixzora);
  const nixzora = charts.filter((c) => c.nixzora);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/size-charts" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ margin: 0, maxWidth: 720 }}>
        {t('lead')}
      </p>
      <details className="card" open={!mine.length}>
        <summary>
          <strong>{t('newChart')}</strong>
        </summary>
        <SizeChartForm action={saveSizeChart} categories={options} />
      </details>
      {mine.map((chart) => (
        <details key={chart.id} className="card">
          <summary className="size-chart-summary">
            <strong>{chart.name}</strong>
            <span className="muted">
              {chart.categoryName} · {t('used', { count: chart.productCount })}
            </span>
          </summary>
          <SizeChartForm
            action={saveSizeChart}
            categories={options}
            initial={{
              id: chart.id,
              name: chart.name,
              categoryId: chart.categoryId,
              text: formatSizeChart(chart, t('size')),
              note: chart.note,
            }}
          />
          <form action={deleteSizeChart} className="size-chart-delete">
            <input type="hidden" name="id" value={chart.id} />
            <button className="btn btn--link" type="submit">
              {t('delete')}
            </button>
            <span className="hint">{t('deleteHint')}</span>
          </form>
        </details>
      ))}
      {nixzora.length ? (
        <section className="stack" style={{ gap: 12 }}>
          <h2>{t('nixzora')}</h2>
          {nixzora.map((chart) => (
            <details key={chart.id} className="card">
              <summary className="size-chart-summary">
                <strong>{chart.name}</strong>
                <span className="muted">
                  {chart.categoryName}
                  {chart.isDefault ? ` · ${t('defaultBadge')}` : ''}
                </span>
              </summary>
              <div className="table-scroll">
                <table className="plain size-table">
                  <thead>
                    <tr>
                      <th scope="col">{t('size')}</th>
                      {chart.columns.map((c) => (
                        <th key={c} scope="col">
                          {c}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {chart.rows.map((row) => (
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
            </details>
          ))}
        </section>
      ) : null}
    </div>
  );
}
