import { CARRIERS, type SellerOrderView } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api, ApiError } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller, SELLER_ORDER_LABEL } from '@/lib/sell';
import { shipSellerOrder } from '../../actions';

export const metadata: Metadata = { title: 'Order', robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function SellerOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const search = await searchParams;
  const seller = await requireSeller(`/sell/orders/${id}`);
  let order: SellerOrderView;
  try {
    order = await api<SellerOrderView>(`/seller/orders/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const money = (cents: number) => formatMoney(cents, order.currency);
  const date = (iso: string | null) =>
    iso
      ? new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(iso),
        )
      : '—';
  const a = order.shipTo;

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/orders" />
      <Notices notice={param(search, 'notice')} error={param(search, 'error')} />

      <section className="card stack">
        <p className="eyebrow">
          <Link href="/sell/orders">Orders</Link>
        </p>
        <h2 className="mono">{order.orderNumber}</h2>
        <p>
          <span className={`pill pill--seller-order-${order.status.toLowerCase()}`}>
            {SELLER_ORDER_LABEL[order.status]}
          </span>{' '}
          <span className="muted">Placed {date(order.placedAt)}</span>
        </p>
        {order.status === 'PAID' ? (
          <p className="banner banner--info">
            Ship within 2 business days, then add the tracking number below.
          </p>
        ) : null}
        {order.status === 'CANCELLED' ? (
          <p className="banner banner--error">
            The customer&apos;s order was cancelled. Do not ship it.
          </p>
        ) : null}
      </section>

      <div className="two-col-sell">
        <section className="card stack">
          <h2>Items to ship</h2>
          <table className="plain">
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td>
                    <strong>
                      {item.quantity} × {item.productTitle}
                    </strong>
                    <div className="muted mono" style={{ fontSize: 13 }}>
                      {item.variantTitle} · {item.sku}
                    </div>
                  </td>
                  <td className="num">{money(item.totalCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <h3>Ship to</h3>
          <address style={{ fontStyle: 'normal' }}>
            {a.fullName}
            <br />
            {a.line1}
            {a.line2 ? (
              <>
                <br />
                {a.line2}
              </>
            ) : null}
            <br />
            {a.city}, {a.region} {a.postalCode}
            <br />
            {a.country}
          </address>
        </section>

        <section className="card stack">
          <h2>Your earnings</h2>
          <dl className="facts">
            <dt>Items</dt>
            <dd>{money(order.itemsCents)}</dd>
            <dt>Shipping paid by customer</dt>
            <dd>{order.shippingCents ? money(order.shippingCents) : 'Free shipping'}</dd>
            <dt>Commission ({order.commissionBps / 100}%)</dt>
            <dd>−{money(order.commissionCents)}</dd>
            {order.refundedCents ? (
              <>
                <dt>Refunded to customer</dt>
                <dd>−{money(order.refundedCents)}</dd>
              </>
            ) : null}
            <dt>
              <strong>You earn</strong>
            </dt>
            <dd>
              <strong>{money(order.netCents)}</strong>
              {order.refundedCents ? <span className="muted"> before refunds</span> : null}
            </dd>
          </dl>
          <p className="muted" style={{ fontSize: 14 }}>
            Earnings are added when you ship and paid out after your {seller.payoutHoldDays}-day
            hold.
          </p>

          {order.status === 'PAID' ? (
            <form action={shipSellerOrder} className="form">
              <h3>Mark as shipped</h3>
              <input type="hidden" name="id" value={order.id} />
              <div className="form-row">
                <label>
                  Carrier
                  <select name="carrier" required defaultValue="">
                    <option value="" disabled>
                      Choose
                    </option>
                    {CARRIERS.map((carrier) => (
                      <option key={carrier}>{carrier}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Tracking number
                  <input
                    name="trackingNumber"
                    required
                    pattern="[A-Za-z0-9\-]{6,40}"
                    autoComplete="off"
                    className="mono"
                  />
                </label>
              </div>
              <div>
                <button className="btn btn--primary" type="submit">
                  Mark as shipped
                </button>
              </div>
            </form>
          ) : order.tracking ? (
            <p>
              Shipped {date(order.shippedAt)} with {order.tracking.carrier}{' '}
              <span className="mono">{order.tracking.number}</span>
              {order.tracking.url ? (
                <>
                  {' · '}
                  <a href={order.tracking.url} rel="noopener noreferrer" target="_blank">
                    Track
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
