import { type Formatters, type Translate } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader } from '@/components/ui';
import type { JobsCheck } from '@nixzora/validation';
import { api, load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return { title: t('nav_dashboard') };
}

type Summary = {
  products: Partial<Record<'DRAFT' | 'ACTIVE' | 'ARCHIVED', number>>;
  customers: number;
  staff: number;
  lowStockCount: number;
  ordersToShip: number;
  salesLast7Days: { cents: number; orders: number };
  lowStock: {
    variantId: string;
    sku: string;
    productId: string;
    productTitle: string;
    available: number;
  }[];
  recentActivity: { id: string; action: string; entityType: string | null; createdAt: string }[];
};

export default async function DashboardPage() {
  const [me, summary, jobs] = await Promise.all([
    currentStaff(),
    load<Summary>('/admin/summary'),
    // Informational: the dashboard still loads when the health check cannot be read.
    api<{ jobs?: JobsCheck }>('/health')
      .then((health) => health.jobs)
      .catch(() => undefined),
  ]);
  const name = me.firstName ?? me.email.split('@')[0];
  const [t, f] = await Promise.all([getT('ops'), getFormat()]);

  return (
    <>
      <PageHeader eyebrow={t('opsCenter')} title={t('hello', { name: name ?? '' })} />

      <section className="grid" aria-label={t('keyNumbers')}>
        <Stat
          label={t('ordersToShip')}
          value={f.number(summary.ordersToShip)}
          alert={summary.ordersToShip > 0}
        />
        <div className="stat">
          <div className="stat__label">
            {t('salesLast7Days', { count: summary.salesLast7Days.orders })}
          </div>
          <div className="stat__value">{f.money(summary.salesLast7Days.cents)}</div>
        </div>
        <Stat label={t('liveProducts')} value={f.number(summary.products.ACTIVE ?? 0)} />
        <Stat label={t('drafts')} value={f.number(summary.products.DRAFT ?? 0)} />
        <Stat
          label={t('lowStockVariants')}
          value={f.number(summary.lowStockCount)}
          alert={summary.lowStockCount > 0}
        />
        {jobs ? <JobsStat jobs={jobs} t={t} f={f} /> : null}
        <Stat label={t('customers')} value={f.number(summary.customers)} />
        <Stat label={t('staffAccounts')} value={f.number(summary.staff)} />
      </section>

      <div className="two-col">
        <section className="card">
          <h2>{t('runningLow')}</h2>
          {summary.lowStock.length === 0 ? (
            <Empty>{t('wellStocked')}</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('colSku')}</th>
                    <th>{t('colProduct')}</th>
                    <th className="num">{t('colAvailable')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.lowStock.map((row) => (
                    <tr key={row.variantId}>
                      <td className="mono">{row.sku}</td>
                      <td>
                        {can(me, 'catalog.write') ? (
                          <Link href={`/products/${row.productId}`}>{row.productTitle}</Link>
                        ) : (
                          row.productTitle
                        )}
                      </td>
                      <td className="num low">{row.available}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {can(me, 'inventory.write') && summary.lowStockCount > 0 ? (
            <p>
              <Link href="/inventory?lowStock=5">
                {t('seeAllCount', { count: f.number(summary.lowStockCount) })}
              </Link>
            </p>
          ) : null}
        </section>

        <section className="card">
          <h2>{t('recentActivity')}</h2>
          {summary.recentActivity.length === 0 ? (
            <Empty>{t('noActivity')}</Empty>
          ) : (
            <ul className="activity">
              {summary.recentActivity.map((entry) => (
                <li key={entry.id}>
                  <span className="mono">{entry.action}</span>
                  <span className="muted">{f.dateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          {can(me, 'audit.read') ? (
            <p>
              <Link href="/audit">{t('openAuditLog')}</Link>
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className={`stat${alert ? ' stat--alert' : ''}`}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value}</div>
    </div>
  );
}

/** Emails, push and indexing waiting in the outbox, and whether the worker is draining it. */
function JobsStat({ jobs, t, f }: { jobs: JobsCheck; t: Translate<'ops'>; f: Formatters }) {
  const stalled = jobs.status === 'down' || jobs.failed > 0;
  const where = t(jobs.mode === 'worker' ? 'jobsWorker' : 'jobsApi');
  const state =
    jobs.status === 'up'
      ? t('jobsRunning', { where })
      : jobs.status === 'down'
        ? jobs.lastRunAt
          ? t('jobsStalledSince', { where, date: f.dateTime(jobs.lastRunAt) })
          : t('jobsStalled', { where })
        : t('jobsNotStarted', { where });
  return (
    <div className={`stat${stalled ? ' stat--alert' : ''}`}>
      <div className="stat__label">{t('notificationsWaiting', { state })}</div>
      <div className="stat__value">{f.number(jobs.backlog)}</div>
      {jobs.failed ? (
        <div className="stat__label">{t('jobsFailed', { count: jobs.failed })}</div>
      ) : null}
    </div>
  );
}
