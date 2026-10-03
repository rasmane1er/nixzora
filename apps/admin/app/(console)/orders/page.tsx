import { type OrderSummary, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader, Pager, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { param, query, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsOrders');
  return { title: t('metaOrders') };
}

const STATUSES = [
  'PAID',
  'FULFILLING',
  'SHIPPED',
  'DELIVERED',
  'PENDING_PAYMENT',
  'CANCELLED',
] as const;

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const status = param(params, 'status');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const [t, tOrder, f] = await Promise.all([getT('opsOrders'), getT('order'), getFormat()]);
  const result = await load<PagedResult<OrderSummary & { email: string }>>(
    `/admin/orders${query({ q, status, page, pageSize: 25 })}`,
  );

  return (
    <>
      <PageHeader eyebrow={t('eyebrowOperations')} title={t('metaOrders')} />
      <form className="toolbar" role="search">
        <label>
          {t('search')}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t('searchOrdersPlaceholder')}
          />
        </label>
        <label>
          {t('status')}
          <select name="status" defaultValue={status ?? ''}>
            <option value="">{t('any')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {tOrder(`status_${s}`)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--secondary" type="submit">
          {t('filter')}
        </button>
      </form>
      <section className="card">
        {result.items.length === 0 ? (
          <Empty>{t('noOrders')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colOrder')}</th>
                  <th>{t('colCustomer')}</th>
                  <th>{t('colPlaced')}</th>
                  <th>{t('status')}</th>
                  <th className="num">{t('colItems')}</th>
                  <th className="num">{t('colTotal')}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link className="mono" href={`/orders/${order.id}`}>
                        {order.number}
                      </Link>
                    </td>
                    <td>{order.email}</td>
                    <td>{f.dateTime(order.placedAt ?? order.createdAt)}</td>
                    <td>
                      <StatusPill value={order.status} />
                    </td>
                    <td className="num">{order.itemCount}</td>
                    <td className="num">{f.money(order.totalCents, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={result.page}
          totalPages={result.totalPages}
          href={(n) => `/orders${query({ q, status, page: n })}`}
        />
      </section>
      <p className="muted">{t('orderCount', { count: result.total })}</p>
    </>
  );
}
