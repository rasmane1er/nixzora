import { type PagedResult, type SellerOrderView } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { param, query, type SearchParams } from '@/lib/params';
import { requireSeller, SELLER_ORDER_LABEL } from '@/lib/sell';

export const metadata: Metadata = { title: 'Orders', robots: { index: false } };

const FILTERS = [
  ['PAID', 'To ship'],
  ['SHIPPED', 'Shipped'],
  ['DELIVERED', 'Delivered'],
  [undefined, 'All'],
] as const;

export default async function SellerOrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = param(params, 'status') ?? (param(params, 'all') ? undefined : 'PAID');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const seller = await requireSeller('/sell/orders');
  const result = await api<PagedResult<SellerOrderView>>(
    `/seller/orders${query({ status, page })}`,
  );
  const date = (iso: string | null) =>
    iso ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso)) : '—';

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/orders" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <nav className="seller-filters" aria-label="Filter orders">
        {FILTERS.map(([value, label]) => (
          <Link
            key={label}
            href={`/sell/orders${value ? query({ status: value }) : '?all=1'}`}
            aria-current={status === value ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {result.items.length === 0 ? (
        <div className="empty card">
          <p>
            {status === 'PAID'
              ? 'Nothing to ship right now. New orders appear here and arrive by email.'
              : 'No orders here yet.'}
          </p>
        </div>
      ) : (
        <section className="card">
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Items</th>
                  <th>Status</th>
                  <th className="num">You earn</th>
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
                        {SELLER_ORDER_LABEL[order.status]}
                      </span>
                    </td>
                    <td className="num">{formatMoney(order.netCents, order.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {result.totalPages > 1 ? (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? (
            <Link href={`/sell/orders${query({ status, page: page - 1 })}`}>← Previous</Link>
          ) : null}
          <span className="muted">
            Page {result.page} of {result.totalPages}
          </span>
          {page < result.totalPages ? (
            <Link href={`/sell/orders${query({ status, page: page + 1 })}`}>Next →</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
