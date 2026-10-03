import { type PagedResult, type SellerOrderView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { param, query, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellerTools');
  return { title: t('metaOrders'), robots: { index: false } };
}

const FILTERS = [
  ['PAID', 'filterToShip'],
  ['SHIPPED', 'filterShipped'],
  ['DELIVERED', 'filterDelivered'],
  [undefined, 'filterAll'],
] as const;

export default async function SellerOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = param(params, 'status') ?? (param(params, 'all') ? undefined : 'PAID');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const seller = await requireSeller('/sell/orders');
  const result = await api<PagedResult<SellerOrderView>>(
    `/seller/orders${query({ status, page })}`,
  );
  const [t, f] = await Promise.all([getT('sellerTools'), getFormat()]);
  const date = (iso: string | null) => (iso ? f.date(iso) : '—');

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/orders" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <nav className="seller-filters" aria-label={t('filterOrdersLabel')}>
        {FILTERS.map(([value, label]) => (
          <Link
            key={label}
            href={`/sell/orders${value ? query({ status: value }) : '?all=1'}`}
            aria-current={status === value ? 'page' : undefined}
          >
            {t(label)}
          </Link>
        ))}
      </nav>

      {result.items.length === 0 ? (
        <div className="empty card">
          <p>{status === 'PAID' ? t('nothingToShip') : t('noOrdersHere')}</p>
        </div>
      ) : (
        <section className="card">
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr>
                  <th>{t('colOrder')}</th>
                  <th>{t('colItems')}</th>
                  <th>{t('colStatus')}</th>
                  <th className="num">{t('colYouEarn')}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <Link href={`/sell/orders/${order.id}`} className="mono">
                        {order.orderNumber}
                      </Link>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {date(order.placedAt)}
                      </div>
                    </td>
                    <td>
                      {order.items
                        .map((item) => `${item.quantity} × ${item.productTitle}`)
                        .join(', ')}
                    </td>
                    <td>
                      <span className={`pill pill--seller-order-${order.status.toLowerCase()}`}>
                        {t(`order_${order.status}`)}
                      </span>
                    </td>
                    <td className="num">{f.money(order.netCents, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {result.totalPages > 1 ? (
        <nav className="pager" aria-label={t('pagesLabel')}>
          {page > 1 ? (
            <Link href={`/sell/orders${query({ status, page: page - 1 })}`}>{t('previous')}</Link>
          ) : null}
          <span className="muted">
            {t('pageOf', { page: result.page, total: result.totalPages })}
          </span>
          {page < result.totalPages ? (
            <Link href={`/sell/orders${query({ status, page: page + 1 })}`}>{t('next')}</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
