import { type AiUsageReport } from '@nixzora/validation';
import type { Metadata } from 'next';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { dateTime, param } from '@/lib/format';
import { reindex } from './actions';

export const metadata: Metadata = { title: 'AI operations' };

type SearchStats = { products: number; indexed: number; stale: number; model: string };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const usd = (value: number) =>
  value === 0
    ? '$0'
    : value < 0.01
      ? `$${value.toFixed(4)}`
      : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

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

  return (
    <>
      <PageHeader eyebrow="Intelligence" title="AI operations" />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <p className="muted">
        Assistant: <strong>{report.config.assistantModel}</strong> · Embeddings:{' '}
        <strong>{report.config.embeddingsModel}</strong>
        {paid
          ? ` · Daily budget ${usd(report.config.dailyBudgetUsd)}, then the free local driver answers.`
          : ' · Free local drivers: no model costs. See the runbook to switch on Claude and Voyage.'}
      </p>

      <nav className="tabs" aria-label="Period">
        {[1, 7, 14, 30].map((d) => (
          <a key={d} href={`/ai?days=${d}`} aria-current={d === days ? 'page' : undefined}>
            {d === 1 ? 'Today' : `${d} days`}
          </a>
        ))}
      </nav>

      <section className="grid" aria-label="Key numbers">
        <Stat
          label={`Model calls, ${days === 1 ? 'today' : `${days} days`}`}
          value={String(report.totals.requests)}
        />
        <Stat label="Estimated cost" value={usd(report.totals.costUsd)} />
        <Stat
          label="Spent today"
          value={usd(report.today.spentUsd)}
          note={paid ? `${report.today.budgetUsedPercent}% of the daily budget` : undefined}
        />
        <Stat
          label="Grounded answers"
          value={report.totals.groundedPercent === null ? '—' : `${report.totals.groundedPercent}%`}
          note="Model text matched catalog facts"
        />
        <Stat
          label="p95 response time"
          value={report.totals.p95LatencyMs === null ? '—' : `${report.totals.p95LatencyMs} ms`}
        />
        <Stat
          label="Errors"
          value={String(report.totals.errors)}
          note="Fell back to the local driver"
        />
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Calls per day</h2>
          {report.daily.length === 0 ? (
            <Empty>No assistant or search model calls in this period.</Empty>
          ) : (
            <div className="bars" role="img" aria-label="Model calls per day">
              {columns.map((d) => (
                <div
                  key={d.day}
                  className="bars__col"
                  title={`${d.day}: ${d.requests} calls, ${usd(d.costUsd)}`}
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
          <h2>Search index</h2>
          {search ? (
            <>
              <p>
                <strong>{search.indexed}</strong> of {search.products} products indexed with{' '}
                <span className="mono">{search.model}</span>
                {search.stale ? ` · ${search.stale} use an older model` : ''}.
              </p>
              <p className="muted small">
                Products re-index themselves when they change. Rebuild after renaming categories or
                brands, or after switching the embedding model.
              </p>
              {can(me, 'catalog.write') ? (
                <div className="row">
                  <ActionButton action={reindex} label="Update changed products" />
                  <ActionButton
                    action={reindex}
                    label="Rebuild everything"
                    fields={{ force: 'true' }}
                    tone="danger"
                  />
                </div>
              ) : null}
            </>
          ) : (
            <Empty>Search index status is not available.</Empty>
          )}
        </section>
      </div>

      <section className="card">
        <h2>By feature and model</h2>
        {report.byFeature.length === 0 ? (
          <Empty>Nothing yet.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Model</th>
                  <th className="num">Calls</th>
                  <th className="num">Tokens in / out</th>
                  <th className="num">Avg time</th>
                  <th className="num">Cost</th>
                </tr>
              </thead>
              <tbody>
                {report.byFeature.map((row) => (
                  <tr key={`${row.feature}-${row.model}`}>
                    <td>{row.feature}</td>
                    <td className="mono">{row.model}</td>
                    <td className="num">{row.requests}</td>
                    <td className="num">
                      {row.inputTokens.toLocaleString('en-US')} /{' '}
                      {row.outputTokens.toLocaleString('en-US')}
                    </td>
                    <td className="num">
                      {row.avgLatencyMs === null ? '—' : `${row.avgLatencyMs} ms`}
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
          <h2>Recent model errors</h2>
          <ul className="plain-list">
            {report.recentErrors.map((e) => (
              <li key={e.at}>
                <span className="muted">{dateTime(e.at)}</span> · {e.feature} ·{' '}
                <span className="mono">{e.model}</span>: {e.error}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
