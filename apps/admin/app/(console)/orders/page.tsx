import { type OrderSummary, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader, Pager, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, money, param, query, type SearchParams } from '@/lib/format';

export const metadata: Metadata = { title: 'Orders' };

const STATUSES = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'PENDING_PAYMENT', 'CANCELLED'];

export default async function OrdersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const status = param(params, 'status');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const result = await load<PagedResult<OrderSummary & { email: string }>>(
    `/admin/orders${query({ q, status, page, pageSize: 25 })}`,
  );

  return (
    <>
      <PageHeader eyebrow="Operations" title="Orders" />
      <form className="toolbar" role="search">
        <label>
          Search
          <input type="search" name="q" defaultValue={q} placeholder="Order number or email" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status ?? ''}>
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace('_', ' ').toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--secondary" type="submit">
          Filter
        </button>
      </form>
      <section className="card">
        {result.items.length === 0 ? (
          <Empty>No orders match.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Placed</th>
                  <th>Status</th>
                  <th className="num">Items</th>
                  <th className="num">Total</th>
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
                    <td>{dateTime(order.placedAt ?? order.createdAt)}</td>
                    <td>
                      <StatusPill value={order.status} />
                    </td>
                    <td className="num">{order.itemCount}</td>
                    <td className="num">{money(order.totalCents, order.currency)}</td>
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
      <p className="muted">{result.total} orders</p>
    </>
  );
}
