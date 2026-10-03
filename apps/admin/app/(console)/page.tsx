import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader } from '@/components/ui';
import type { JobsCheck } from '@nixzora/validation';
import { api, load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { dateTime, money } from '@/lib/format';

export const metadata: Metadata = { title: 'Dashboard' };

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

  return (
    <>
      <PageHeader eyebrow="Ops Center" title={`Hello, ${name}`} />

      <section className="grid" aria-label="Key numbers">
        <Stat
          label="Orders to ship"
          value={summary.ordersToShip}
          alert={summary.ordersToShip > 0}
        />
        <div className="stat">
          <div className="stat__label">
            Sales, last 7 days ({summary.salesLast7Days.orders} orders)
          </div>
          <div className="stat__value">{money(summary.salesLast7Days.cents)}</div>
        </div>
        <Stat label="Live products" value={summary.products.ACTIVE ?? 0} />
        <Stat label="Drafts" value={summary.products.DRAFT ?? 0} />
        <Stat
          label="Low-stock variants"
          value={summary.lowStockCount}
          alert={summary.lowStockCount > 0}
        />
        {jobs ? <JobsStat jobs={jobs} /> : null}
        <Stat label="Customers" value={summary.customers} />
        <Stat label="Staff accounts" value={summary.staff} />
      </section>

      <div className="two-col">
        <section className="card">
          <h2>Running low (5 or fewer available)</h2>
          {summary.lowStock.length === 0 ? (
            <Empty>Everything is well stocked.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="num">Available</th>
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
              <Link href="/inventory?lowStock=5">See all {summary.lowStockCount} →</Link>
            </p>
          ) : null}
        </section>

        <section className="card">
          <h2>Recent activity</h2>
          {summary.recentActivity.length === 0 ? (
            <Empty>No activity yet.</Empty>
          ) : (
            <ul className="activity">
              {summary.recentActivity.map((entry) => (
                <li key={entry.id}>
                  <span className="mono">{entry.action}</span>
                  <span className="muted">{dateTime(entry.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          {can(me, 'audit.read') ? (
            <p>
              <Link href="/audit">Open audit log →</Link>
            </p>
          ) : null}
        </section>
      </div>
    </>
  );
}

function Stat({ label, value, alert = false }: { label: string; value: number; alert?: boolean }) {
  return (
    <div className={`stat${alert ? ' stat--alert' : ''}`}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">{value.toLocaleString('en-US')}</div>
    </div>
  );
}

/** Emails, push and indexing waiting in the outbox, and whether the worker is draining it. */
function JobsStat({ jobs }: { jobs: JobsCheck }) {
  const stalled = jobs.status === 'down' || jobs.failed > 0;
  const where = jobs.mode === 'worker' ? 'notifications worker' : 'API';
  const state =
    jobs.status === 'up'
      ? `${where} running`
      : jobs.status === 'down'
        ? `${where} stalled${jobs.lastRunAt ? ` since ${dateTime(jobs.lastRunAt)}` : ''}`
        : `${where} not started yet`;
  return (
    <div className={`stat${stalled ? ' stat--alert' : ''}`}>
      <div className="stat__label">Notifications waiting ({state})</div>
      <div className="stat__value">{jobs.backlog.toLocaleString('en-US')}</div>
      {jobs.failed ? (
        <div className="stat__label">{jobs.failed} failed after every retry</div>
      ) : null}
    </div>
  );
}
