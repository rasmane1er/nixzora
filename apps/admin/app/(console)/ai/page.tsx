import { INTL_LOCALE, type Locale, rich } from '@nixzora/i18n';
import { type AiUsageReport } from '@nixzora/validation';
import type { Metadata } from 'next';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { param } from '@/lib/format';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { reindex } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return { title: t('nav_ai') };
}

type SearchStats = { products: number; indexed: number; stale: number; model: string };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Dollars (not cents), with four decimals for fractions of a cent. */
const usdFormatter = (locale: Locale) => (value: number) =>
  new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: value === 0 ? 0 : value < 0.01 ? 4 : 2,
    maximumFractionDigits: value === 0 ? 0 : value < 0.01 ? 4 : 2,
  }).format(value);

/** The last `n` UTC days as YYYY-MM-DD, oldest first. */
function lastDays(n: number): string[] {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) =>
    new Date(now - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10),
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="stat">
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
      {note ? <div className="muted small">{note}</div> : null}
    </div>
  );
}

/** p6-09: what the AI layer costs, how fast it answers and whether it stays grounded. */
export default async function AiOperationsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const days = Math.min(90, Math.max(1, Number(param(params, 'days')) || 14));
  const [me, report, search] = await Promise.all([
    currentStaff(),
    load<AiUsageReport>(`/admin/ai/usage?days=${days}`),
    load<SearchStats>('/admin/search/stats').catch(() => null),
  ]);
  // One column per day in the period (up to 30), zero where nothing ran.
  const byDay = new Map(report.daily.map((d) => [d.day, d]));
  const columns = lastDays(Math.min(days, 30)).map(
    (day) => byDay.get(day) ?? { day, requests: 0, costUsd: 0, errors: 0, avgLatencyMs: null },
  );
  const maxRequests = Math.max(1, ...columns.map((d) => d.requests));
  const paid =
    report.config.assistantDriver !== 'local' || report.config.embeddingsDriver !== 'local';
  const [t, ops, f, locale] = await Promise.all([
    getT('opsPeople'),
    getT('ops'),
    getFormat(),
    getLocale(),
  ]);
  const usd = usdFormatter(locale);
  const bold = (chunk: string) => <strong key="b">{chunk}</strong>;

  return (
    <>
      <PageHeader eyebrow={t('intelligence')} title={ops('nav_ai')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <p className="muted">
        {rich(t('assistantModel', { model: report.config.assistantModel }), { b: bold })} ·{' '}
        {rich(t('embeddingsModel', { model: report.config.embeddingsModel }), { b: bold })} ·{' '}
        {paid ? t('paidNote', { amount: usd(report.config.dailyBudgetUsd) }) : t('freeNote')}
      </p>

      <nav className="tabs" aria-label={t('period')}>
        {[1, 7, 14, 30].map((d) => (
          <a key={d} href={`/ai?days=${d}`} aria-current={d === days ? 'page' : undefined}>
            {d === 1 ? t('today') : t('daysCount', { count: d })}
          </a>
        ))}
      </nav>

      <section className="grid" aria-label={ops('keyNumbers')}>
        <Stat
          label={days === 1 ? t('modelCallsToday') : t('modelCallsDays', { count: days })}
          value={f.number(report.totals.requests)}
        />
        <Stat label={t('estimatedCost')} value={usd(report.totals.costUsd)} />
        <Stat
          label={t('spentToday')}
          value={usd(report.today.spentUsd)}
          note={
            paid
              ? t('budgetUsed', { percent: f.percent(report.today.budgetUsedPercent / 100) })
              : undefined
          }
        />
        <Stat
          label={t('groundedAnswers')}
          value={
            report.totals.groundedPercent === null
              ? '—'
              : f.percent(report.totals.groundedPercent / 100)
          }
          note={t('groundedNote')}
        />
        <Stat
          label={t('p95')}
          value={
            report.totals.p95LatencyMs === null
              ? '—'
              : t('milliseconds', { value: f.number(report.totals.p95LatencyMs) })
          }
        />
        <Stat label={t('errors')} value={f.number(report.totals.errors)} note={t('errorsNote')} />
      </section>

      <div className="two-col">
        <section className="card">
          <h2>{t('callsPerDay')}</h2>
          {report.daily.length === 0 ? (
            <Empty>{t('noCalls')}</Empty>
          ) : (
            <div className="bars" role="img" aria-label={t('callsPerDayLabel')}>
              {columns.map((d) => (
                <div
                  key={d.day}
                  className="bars__col"
                  title={t('barTitle', { day: d.day, count: d.requests, cost: usd(d.costUsd) })}
                >
                  <div
                    className="bars__bar"
                    style={{ height: `${(d.requests / maxRequests) * 100}%` }}
                  />
                  <span className="bars__label">{d.day.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="card">
          <h2>{t('searchIndex')}</h2>
          {search ? (
            <>
              <p>
                {rich(
                  t('indexedSummary', {
                    indexed: f.number(search.indexed),
                    total: f.number(search.products),
                    model: search.model,
                  }),
                  {
                    b: bold,
                    model: (chunk) => (
                      <span key="model" className="mono">
                        {chunk}
                      </span>
                    ),
                  },
                )}
                {search.stale ? t('staleCount', { count: f.number(search.stale) }) : ''}.
              </p>
              <p className="muted small">{t('reindexHint')}</p>
              {can(me, 'catalog.write') ? (
                <div className="row">
                  <ActionButton action={reindex} label={t('updateChanged')} />
                  <ActionButton
                    action={reindex}
                    label={t('rebuildAll')}
                    fields={{ force: 'true' }}
                    tone="danger"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <Empty>{t('indexUnavailable')}</Empty>
          )}
        </section>
      </div>

      <section className="card">
        <h2>{t('byFeature')}</h2>
        {report.byFeature.length === 0 ? (
          <Empty>{t('nothingYet')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colFeature')}</th>
                  <th>{t('colModel')}</th>
                  <th className="num">{t('colCalls')}</th>
                  <th className="num">{t('colTokens')}</th>
                  <th className="num">{t('colAvgTime')}</th>
                  <th className="num">{t('colCost')}</th>
                </tr>
              </thead>
              <tbody>
                {report.byFeature.map((row) => (
                  <tr key={`${row.feature}-${row.model}`}>
                    <td>{row.feature}</td>
                    <td className="mono">{row.model}</td>
                    <td className="num">{f.number(row.requests)}</td>
                    <td className="num">
                      {f.number(row.inputTokens)} / {f.number(row.outputTokens)}
                    </td>
                    <td className="num">
                      {row.avgLatencyMs === null
                        ? '—'
                        : t('milliseconds', { value: f.number(row.avgLatencyMs) })}
                    </td>
                    <td className="num">{usd(row.costUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report.recentErrors.length ? (
        <section className="card">
          <h2>{t('recentErrors')}</h2>
          <ul className="plain-list">
            {report.recentErrors.map((e) => (
              <li key={e.at}>
                <span className="muted">{f.dateTime(e.at)}</span> · {e.feature} ·{' '}
                <span className="mono">{e.model}</span>: {e.error}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
