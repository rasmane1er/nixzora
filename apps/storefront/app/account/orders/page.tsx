import { type AccountOrder, type OrderFilter, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { AccountOrderCard } from '@/components/AccountOrderCard';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { param, query, type SearchParams } from '@/lib/params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('accountActivity');
  return { title: t('ordersTitle'), robots: { index: false } };
}

const TABS = [
  { filter: 'all', label: 'tabAll' },
  { filter: 'open', label: 'tabOpen' },
  { filter: 'delivered', label: 'tabDelivered' },
  { filter: 'returns', label: 'tabReturns' },
  { filter: 'cancelled', label: 'tabCancelled' },
] as const satisfies readonly { filter: OrderFilter; label: string }[];

const PERIODS = [
  { value: '', label: 'periodAny', within: undefined },
  { value: '30', label: 'period30', within: 'inPeriod30' },
  { value: '90', label: 'period90', within: 'inPeriod90' },
  { value: '365', label: 'period365', within: 'inPeriod365' },
] as const;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const t = await getT('accountActivity');
  const filter = (TABS.find((tab) => tab.filter === param(params, 'filter'))?.filter ??
    'all') as OrderFilter;
  const q = param(params, 'q')?.slice(0, 100) ?? '';
  const period = PERIODS.find((p) => p.value && p.value === param(params, 'days'));
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
      <AccountHeader title={t('ordersTitle')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <nav className="seller-filters" aria-label={t('showOrders')}>
        {TABS.map((tab) => (
          <Link
            key={tab.filter}
            href={link({ filter: tab.filter === 'all' ? undefined : tab.filter, page: undefined })}
            aria-current={tab.filter === filter ? 'page' : undefined}
          >
            {t(tab.label)}
          </Link>
        ))}
      </nav>

      <form className="order-search" role="search" action="/account/orders">
        {filter !== 'all' ? <input type="hidden" name="filter" value={filter} /> : null}
        <label className="sr-only" htmlFor="order-q">
          {t('searchOrdersLabel')}
        </label>
        <input
          id="order-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={t('searchOrdersPlaceholder')}
          maxLength={100}
        />
        <label className="sr-only" htmlFor="order-days">
          {t('placedLabel')}
        </label>
        <select id="order-days" name="days" defaultValue={days ?? ''}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {t(p.label)}
            </option>
          ))}
        </select>
        <button className="btn btn--secondary" type="submit">
          {t('searchOrders')}
        </button>
      </form>

      <p className="muted" style={{ margin: 0 }}>
        {t('ordersCount', { count: result.total })}
        {q ? ` ${t('ordersMatching', { q })}` : ''}
        {period?.within ? ` ${t(period.within)}` : ''}
      </p>

      {result.items.length === 0 ? (
        <div className="card stack" style={{ gap: 8 }}>
          <p style={{ margin: 0 }}>
            {q || days || filter !== 'all' ? t('noOrdersMatch') : t('noOrdersYet')}
          </p>
          <p style={{ margin: 0 }}>
            {q || days || filter !== 'all' ? (
              <Link href="/account/orders">{t('showAllOrders')}</Link>
            ) : (
              <Link href="/search">{t('startShopping')}</Link>
            )}
          </p>
        </div>
      ) : (
        result.items.map((order) => <AccountOrderCard key={order.id} order={order} back={here} />)
      )}

      {result.totalPages > 1 ? (
        <nav className="pager" aria-label={t('pagesLabel')}>
          {page > 1 ? <Link href={link({ page: page - 1 })}>{t('newer')}</Link> : <span />}
          <span className="muted">{t('pageOf', { page, total: result.totalPages })}</span>
          {page < result.totalPages ? (
            <Link href={link({ page: page + 1 })}>{t('older')}</Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </div>
  );
}
