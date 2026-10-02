import { type OrderView } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';

export const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  PAID: 'Confirmed',
  FULFILLING: 'Packing',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  PARTIALLY_REFUNDED: 'Partly refunded',
  REFUNDED: 'Refunded',
};

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`pill pill--${status.toLowerCase()}`}>{STATUS_LABEL[status] ?? status}</span>
  );
}

export function OrderTotals({
  order,
}: {
  order: Pick<
    OrderView,
    | 'subtotalCents'
    | 'discountCents'
    | 'couponCode'
    | 'shippingCents'
    | 'taxCents'
    | 'totalCents'
    | 'refundedCents'
    | 'currency'
  >;
}) {
  const m = (cents: number) => formatMoney(cents, order.currency);
  return (
    <dl>
      <dt>Subtotal</dt>
      <dd>{m(order.subtotalCents)}</dd>
      {order.discountCents ? (
        <>
          <dt>Discount{order.couponCode ? ` (${order.couponCode})` : ''}</dt>
          <dd className="discount">−{m(order.discountCents)}</dd>
        </>
      ) : null}
      <dt>Shipping</dt>
      <dd>{order.shippingCents ? m(order.shippingCents) : 'Free'}</dd>
      <dt>Tax</dt>
      <dd>{m(order.taxCents)}</dd>
      <dt className="total">Total</dt>
      <dd className="total">{m(order.totalCents)}</dd>
      {order.refundedCents ? (
        <>
          <dt>Refunded</dt>
          <dd className="discount">−{m(order.refundedCents)}</dd>
        </>
      ) : null}
    </dl>
  );
}

export function OrderItems({ order }: { order: OrderView }) {
  return (
    <ul className="mini-lines">
      {order.items.map((item) => (
        <li key={item.sku}>
          <span>
            {item.quantity} × {item.productTitle}
            <span className="muted"> · {item.variantTitle}</span>
          </span>
          <span>{formatMoney(item.totalCents, order.currency)}</span>
        </li>
      ))}
    </ul>
  );
}

const STEPS = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED'] as const;

export function OrderTimeline({ order }: { order: OrderView }) {
  const at = new Map(order.timeline.map((entry) => [entry.status, entry.at]));
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  return (
    <ol className="timeline" aria-label="Order progress">
      {STEPS.map((step) => {
        const when = at.get(step);
        return (
          <li key={step} data-done={Boolean(when)}>
            <strong>{STATUS_LABEL[step]}</strong>
            <span className="muted">{when ? fmt(when) : '—'}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function AddressBlock({ address }: { address: OrderView['shippingAddress'] }) {
  return (
    <address className="address">
      {address.fullName}
      <br />
      {address.line1}
      {address.line2 ? (
        <>
          <br />
          {address.line2}
        </>
      ) : null}
      <br />
      {address.city}, {address.region} {address.postalCode}
    </address>
  );
}
