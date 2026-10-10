import { deliveryRange, INTL_LOCALE, type MessageKey } from '@nixzora/i18n';
import { type OrderView, type TrackingStep } from '@nixzora/validation';
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
    | 'giftBalanceCents'
    | 'plusSavingsCents'
    | 'shippingSpeed'
    | 'kind'
    | 'bundleDiscountCents'
    | 'clipDiscountCents'
    | 'gift'
  >;
}) {
  const gf = await getT('gift');
  const t = await getT('order');
  const pl = await getT('plus');
  const bd = await getT('bundles');
  const cl = await getT('clips');
  const g = await getT('gifts');
  const f = await getFormat();
  const m = (cents: number) => f.money(cents, order.currency);
  return (
    <dl>
      <dt>{t('subtotal')}</dt>
      <dd>{m(order.subtotalCents)}</dd>
      {order.bundleDiscountCents ? (
        <>
          <dt>{bd('orderLine')}</dt>
          <dd className="discount">−{m(order.bundleDiscountCents)}</dd>
        </>
      ) : null}
      {order.clipDiscountCents ? (
        <>
          <dt>{cl('savings')}</dt>
          <dd className="discount">−{m(order.clipDiscountCents)}</dd>
        </>
      ) : null}
      {order.discountCents - (order.bundleDiscountCents ?? 0) - (order.clipDiscountCents ?? 0) ? (
        <>
          <dt>
            {order.couponCode ? t('discountWithCode', { code: order.couponCode }) : t('discount')}
          </dt>
          <dd className="discount">
            −
            {m(
              order.discountCents -
                (order.bundleDiscountCents ?? 0) -
                (order.clipDiscountCents ?? 0),
            )}
          </dd>
        </>
      ) : null}
      {order.kind === 'PLUS' ? null : (
        <>
          <dt>{t('shipping')}</dt>
          <dd>
            {order.shippingCents
              ? m(order.shippingCents)
              : order.shippingSpeed === 'TWO_DAY' || order.plusSavingsCents
                ? pl('freeWithPlus')
                : t('free')}
          </dd>
        </>
      )}
      <dt>{t('tax')}</dt>
      <dd>{m(order.taxCents)}</dd>
      {order.gift?.wrapCents ? (
        <>
          <dt>{gf('wrapLine')}</dt>
          <dd>{m(order.gift.wrapCents)}</dd>
        </>
      ) : null}
      <dt className="total">{t('total')}</dt>
      <dd className="total">{m(order.totalCents)}</dd>
      {order.giftBalanceCents ? (
        <>
          <dt>{g('balanceLine')}</dt>
          <dd className="discount">−{m(order.giftBalanceCents)}</dd>
        </>
      ) : null}
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
  const d = await getT('delivery');
  const locale = await getLocale();
  const tag = INTL_LOCALE[locale];
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
            <span className="muted">
              {when
                ? fmt(when)
                : step === 'DELIVERED' && order.estimatedDelivery
                  ? d('expected', { range: deliveryRange(order.estimatedDelivery, locale) })
                  : '—'}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Carrier scans for one parcel, newest first (p10-04). */
export async function TrackingScans({ events }: { events: TrackingStep[] | undefined }) {
  const d = await getT('delivery');
  const tag = INTL_LOCALE[await getLocale()];
  if (!events?.length) return <p className="muted tracking-empty">{d('noScans')}</p>;
  const fmt = new Intl.DateTimeFormat(tag, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <ol className="scans" aria-label={d('trackingTitle')}>
      {events.map((event) => (
        <li key={`${event.at}-${event.status}`} data-status={event.status.toLowerCase()}>
          <strong>{d(`step_${event.status}`)}</strong>
          <span>{event.description}</span>
          <span className="muted">
            {fmt.format(new Date(event.at))}
            {event.location ? ` · ${event.location}` : ''}
          </span>
        </li>
      ))}
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
