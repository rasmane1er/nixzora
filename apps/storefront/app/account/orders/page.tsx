import { type AccountOrder, type OrderFilter, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { AccountOrderCard } from '@/components/AccountOrderCard';
import { accountApi } from '@/lib/account';
import { param, query, type SearchParams } from '@/lib/params';

export const metadata: Metadata = { title: 'Your orders', robots: { index: false } };

const TABS: { filter: OrderFilter; label: string }[] = [
  { filter: 'all', label: 'All orders' },
  { filter: 'open', label: 'On the way' },
  { filter: 'delivered', label: 'Delivered' },
  { filter: 'returns', label: 'Returns' },
  { filter: 'cancelled', label: 'Cancelled' },
];

const PERIODS = [
  { value: '', label: 'Any time' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 3 months' },
  { value: '365', label: 'Last 12 months' },
];

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const filter = (TABS.find((t) => t.filter === param(params, 'filter'))?.filter ??
    'all') as OrderFilter;
  const q = param(params, 'q')?.slice(0, 100) ?? '';
  const days = PERIODS.some((p) => p.value && p.value === param(params, 'days'))
    ? param(params, 'days')
    : undefined;
  const page = Math.max(1, Number(param(params, 'page')) || 1);
  const here = `/account/orders${query({ filter: filter === 'all' ? undefined : filter, q: q || undefined, days, page: page > 1 ? page : undefined })}`;
  const result = await accountApi<PagedResult<AccountOrder>>(
    `/me/order-history${query({ filter, q: q || undefined, days, page, pageSize: 10 })}`,
    here,
  );
  const link = (changes: Record<string, string | number | undefined>) =>
    `/account/orders${query({
      filter: filter === 'all' ? undefined : filter,
      q: q || undefined,
      days,
      ...changes,
    })}`;

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title="Your orders" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <nav className="seller-filters" aria-label="Show orders">
        {TABS.map((tab) => (
          <Link
            key={tab.filter}
            href={link({ filter: tab.filter === 'all' ? undefined : tab.filter, page: undefined })}
            aria-current={tab.filter === filter ? 'page' : undefined}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      <form className="order-search" role="search" action="/account/orders">
        {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
        <label className="sr-only" htmlFor="order-q">
          Search your orders
        </label>
        <input
          id="order-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search by product or order number"
          maxLength={100}
        />
        <label className="sr-only" htmlFor="order-days">
          Placed
        </label>
        <select id="order-days" name="days" defaultValue={days ?? ''}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
        <button className="btn btn--secondary" type="submit">
          Search orders
        </button>
      </form>

      <p className="muted" style={{ margin: 0 }}>
        {result.total} {result.total === 1 ? 'order' : 'orders'}
        {q ? ` matching “${q}”` : ''}
        {days ? ` in the ${PERIODS.find((p) => p.value === days)?.label.toLowerCase()}` : ''}
      </p>

      {result.items.length === 0 ? (
        <div className="card stack" style={{ gap: 8 }}>
          <p style={{ margin: 0 }}>
            {q || days || filter !== 'all'
              ? 'No orders match. Try another search or show all orders.'
              : 'You have not ordered anything yet.'}
          </p>
          <p style={{ margin: 0 }}>
            {q || days || filter !== 'all' ? (
              <Link href="/account/orders">Show all orders →</Link>
            ) : (
              <Link href="/search">Start shopping →</Link>
            )}
          </p>
        </div>
      ) : (
        result.items.map((order) => <AccountOrderCard key={order.id} order={order} back={here} />)
      )}

      {result.totalPages > 1 ? (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? <Link href={link({ page: page - 1 })}>← Newer</Link> : <span />}
          <span className="muted">
            Page {page} of {result.totalPages}
          </span>
          {page < result.totalPages ? (
            <Link href={link({ page: page + 1 })}>Older →</Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
