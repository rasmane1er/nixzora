import { INTL_LOCALE, type MessageKey } from '@nixzora/i18n';
import { type OrderView } from '@nixzora/validation';
import { getFormat, getLocale, getT } from '@/lib/i18n';

/** An order status in the visitor's language (as sent when NIXZORA doesn't know it). */
export async function statusLabel(status: string): Promise<string> {
  const t = await getT('order');
  const key = `status_${status}` as MessageKey<'order'>;
  const label = t(key);
  return label === key ? status : label;
}

export async function StatusPill({ status }: { status: string }) {
  return <span className={`pill pill--${status.toLowerCase()}`}>{await statusLabel(status)}</span>;
}

export async function OrderTotals({
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
  const t = await getT('order');
  const f = await getFormat();
  const m = (cents: number) => f.money(cents, order.currency);
  return (
    <dl>
      <dt>{t('subtotal')}</dt>
      <dd>{m(order.subtotalCents)}</dd>
      {order.discountCents ? (
        <>
          <dt>
            {order.couponCode ? t('discountWithCode', { code: order.couponCode }) : t('discount')}
          </dt>
          <dd className="discount">−{m(order.discountCents)}</dd>
        </>
      ) : null}
      <dt>{t('shipping')}</dt>
      <dd>{order.shippingCents ? m(order.shippingCents) : t('free')}</dd>
      <dt>{t('tax')}</dt>
      <dd>{m(order.taxCents)}</dd>
      <dt className="total">{t('total')}</dt>
      <dd className="total">{m(order.totalCents)}</dd>
      {order.refundedCents ? (
        <>
          <dt>{t('refunded')}</dt>
          <dd className="discount">−{m(order.refundedCents)}</dd>
        </>
      ) : null}
    </dl>
  );
}

export async function OrderItems({ order }: { order: OrderView }) {
  const f = await getFormat();
  return (
    <ul className="mini-lines">
      {order.items.map((item) => (
        <li key={item.sku}>
          <span>
            {item.quantity} × {item.productTitle}
            <span className="muted"> · {item.variantTitle}</span>
          </span>
          <span>{f.money(item.totalCents, order.currency)}</span>
        </li>
      ))}
    </ul>
  );
}

const STEPS = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED'] as const;

export async function OrderTimeline({ order }: { order: OrderView }) {
  const t = await getT('order');
  const tag = INTL_LOCALE[await getLocale()];
  const at = new Map(order.timeline.map((entry) => [entry.status, entry.at]));
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat(tag, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  return (
    <ol className="timeline" aria-label={t('orderProgress')}>
      {STEPS.map((step) => {
        const when = at.get(step);
        return (
          <li key={step} data-done={Boolean(when)}>
            <strong>{t(`status_${step}`)}</strong>
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
