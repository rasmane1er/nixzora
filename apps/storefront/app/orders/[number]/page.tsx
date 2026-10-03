import { type OrderView, type ReturnView } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  AddressBlock,
  OrderItems,
  OrderTimeline,
  OrderTotals,
  StatusPill,
} from '@/components/OrderSummary';
import { api, ApiError } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { ReturnForm } from './ReturnForm';

const RETURN_LABEL: Record<string, string> = {
  REQUESTED: 'Return requested',
  APPROVED: 'Return approved — send the items back',
  REJECTED: 'Return not accepted',
  RECEIVED: 'Return received',
  REFUNDED: 'Return refunded',
};

export const metadata: Metadata = { title: 'Your order', robots: { index: false } };

type Props = { params: Promise<{ number: string }>; searchParams: SearchParams };

export default async function OrderPage({ params, searchParams }: Props) {
  const { number } = await params;
  const search = await searchParams;
  const token = param(search, 'token');
  const confirming =
    param(search, 'confirming') === '1' || param(search, 'redirect_status') === 'succeeded';
  if (!/^NX-[A-Z0-9]{6}$/.test(number)) notFound();
  if (!token && !(await isSignedIn())) notFound();
  const qs = token ? `?token=${encodeURIComponent(token)}` : '';

  let order: OrderView;
  let returns: ReturnView[] = [];
  try {
    order = await api<OrderView>(`/orders/${number}${qs}`);
    returns = await api<ReturnView[]>(`/orders/${number}/returns${qs}`).catch(() => []);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) notFound();
    throw error;
  }

  const waiting = order.status === 'PENDING_PAYMENT' && confirming;
  const unpaid = order.status === 'PENDING_PAYMENT' && !confirming;

  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      {/* While the payment provider confirms, check again every few seconds. */}
      {waiting ? <meta httpEquiv="refresh" content="3" /> : null}
      <div className="stack" style={{ gap: 8 }}>
        <p className="eyebrow">Order {order.number}</p>
        <h1>
          {order.status === 'PENDING_PAYMENT'
            ? waiting
              ? 'Confirming your payment…'
              : 'Waiting for payment'
            : order.status === 'CANCELLED'
              ? 'This order was cancelled'
              : 'Thank you! Your order is confirmed.'}
        </h1>
        <p className="muted">
          <StatusPill status={order.status} /> · Receipt sent to {order.email}
        </p>
      </div>

      {unpaid ? (
        <p className="banner banner--info">
          We haven’t received payment yet.{' '}
          <Link href={`/checkout/pay/${order.number}${qs}`}>Complete payment →</Link>
        </p>
      ) : null}

      {order.status !== 'PENDING_PAYMENT' && order.status !== 'CANCELLED' ? (
        <section className="card stack">
          <OrderTimeline order={order} />
          {order.shipments.length ? (
            <Shipments order={order} />
          ) : order.tracking ? (
            <p>
              {order.tracking.carrier} tracking{' '}
              <span className="mono">{order.tracking.number}</span>
              {order.tracking.url ? (
                <>
                  {' · '}
                  <a href={order.tracking.url} rel="noopener noreferrer" target="_blank">
                    Track package
                  </a>
                </>
              ) : null}
            </p>
          ) : (
            <p className="muted">You’ll get an email with tracking as soon as it ships.</p>
          )}
        </section>
      ) : null}

      {returns.length ? (
        <section className="card stack">
          <h2>Returns</h2>
          {returns.map((r) => (
            <div key={r.id} className="stack" style={{ gap: 4 }}>
              <strong>
                {RETURN_LABEL[r.status] ?? r.status}
                {r.refundCents ? ` · ${formatMoney(r.refundCents)} refunded` : ''}
              </strong>
              <span className="muted">
                {r.items.map((i) => `${i.quantity} × ${i.productTitle}`).join(', ')} — {r.reason}
              </span>
              {r.staffNote ? <span>{r.staffNote}</span> : null}
            </div>
          ))}
        </section>
      ) : null}

      {order.returnableUntil ? (
        <div className="stack" style={{ gap: 6 }}>
          <ReturnForm order={order} token={token} />
          <p className="hint">
            Returns are open until{' '}
            {new Intl.DateTimeFormat('en-US', { dateStyle: 'long' }).format(
              new Date(order.returnableUntil),
            )}
            .
          </p>
        </div>
      ) : null}

      <div className="two">
        <section className="card summary">
          <h2>Items</h2>
          <OrderItems order={order} />
          <OrderTotals order={order} />
        </section>
        <section className="card stack">
          <h2>Shipping to</h2>
          <AddressBlock address={order.shippingAddress} />
          {token ? (
            <p className="hint">
              Keep this page’s link (it’s also in your email) to check on your order.
            </p>
          ) : null}
        </section>
      </div>
      <Link href="/search">Continue shopping →</Link>
    </div>
  );
}

const SHIPMENT_LABEL: Record<OrderView['shipments'][number]['status'], string> = {
  PROCESSING: 'Preparing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
};

/** Marketplace orders arrive in parcels: NIXZORA's own items and one per seller. */
function Shipments({ order }: { order: OrderView }) {
  return (
    <ul className="shipments">
      {order.shipments.map((shipment) => {
        const items = order.items.filter((item) => shipment.itemIds.includes(item.id));
        return (
          <li key={shipment.seller?.handle ?? 'nixzora'}>
            <div>
              <strong>
                {shipment.seller ? (
                  <>
                    From{' '}
                    <Link href={`/s/${shipment.seller.handle}`}>{shipment.seller.displayName}</Link>
                  </>
                ) : (
                  'From NIXZORA'
                )}
              </strong>{' '}
              <span className="muted">· {SHIPMENT_LABEL[shipment.status]}</span>
            </div>
            <div className="muted" style={{ fontSize: 14 }}>
              {items.map((item) => `${item.quantity} × ${item.productTitle}`).join(', ')}
            </div>
            {shipment.tracking ? (
              <div style={{ fontSize: 14 }}>
                {shipment.tracking.carrier} <span className="mono">{shipment.tracking.number}</span>
                {shipment.tracking.url ? (
                  <>
                    {' · '}
                    <a href={shipment.tracking.url} rel="noopener noreferrer" target="_blank">
                      Track package
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
