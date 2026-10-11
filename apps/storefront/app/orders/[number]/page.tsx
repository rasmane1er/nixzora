import { calendarDay, deliveryRange, INTL_LOCALE, type MessageKey, rich } from '@nixzora/i18n';
import { type OrderView, type ReturnView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { GiftCardLines } from '@/components/GiftCardLines';
import { notFound } from 'next/navigation';
import {
  AddressBlock,
  OrderItems,
  OrderTimeline,
  TrackingScans,
  OrderTotals,
  StatusPill,
} from '@/components/OrderSummary';
import { api, ApiError } from '@/lib/api';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { RateSellerForm } from './RateSellerForm';
import { ReturnForm } from './ReturnForm';
import { cancelOrder } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('order');
  return { title: t('title'), robots: { index: false } };
}

/** `prefix_VALUE` from the order messages, or the value as sent when there is no such key. */
function label(t: (key: MessageKey<'order'>) => string, prefix: string, value: string): string {
  const key = `${prefix}_${value}` as MessageKey<'order'>;
  const text = t(key);
  return text === key ? value : text;
}

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

  const t = await getT('order');
  const w = await getT('wallet');
  const pl = await getT('plus');
  const ha = await getT('helpAgent');
  const gf = await getT('gift');
  const po = await getT('preorders');
  const f = await getFormat();
  const placed = param(search, 'placed') === '1';
  const notice = param(search, 'notice');
  const problem = param(search, 'error');
  const locale = await getLocale();
  const waiting = order.status === 'PENDING_PAYMENT' && confirming;
  const unpaid = order.status === 'PENDING_PAYMENT' && !confirming;

  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      {/* While the payment provider confirms, check again every few seconds. */}
      {waiting ? <meta httpEquiv="refresh" content="3" /> : null}
      <div className="stack" style={{ gap: 8 }}>
        <p className="eyebrow">{t('orderNumber', { number: order.number })}</p>
        <h1>
          {order.status === 'PENDING_PAYMENT'
            ? waiting
              ? t('confirmingPayment')
              : t('waitingForPayment')
            : order.status === 'CANCELLED'
              ? t('cancelledTitle')
              : t('confirmedTitle')}
        </h1>
        <p className="muted">
          <StatusPill status={order.status} /> · {t('receiptSentTo', { email: order.email })}
        </p>
      </div>

      {problem ? (
        <p className="banner banner--error" role="alert">
          {problem}
        </p>
      ) : notice ? (
        <p className="banner banner--ok" role="status">
          {notice}
        </p>
      ) : placed && order.status !== 'CANCELLED' ? (
        <p className="banner banner--ok" role="status">
          {w('placedTitle')}
        </p>
      ) : null}

      {/* Changed your mind (p10-09): cancel within 30 minutes, before anything is packed. */}
      {order.cancellableUntil ? (
        <details className="card cancel-order">
          <summary>
            {/* Pre-orders (p10-30) stay cancellable until release day. */}
            {order.preorderShipsOn
              ? po('orderNote', { date: calendarDay(order.preorderShipsOn, locale) })
              : w('cancelUntil', {
                  time: new Intl.DateTimeFormat(INTL_LOCALE[locale], {
                    hour: 'numeric',
                    minute: '2-digit',
                    timeZone: 'America/New_York',
                    timeZoneName: 'short',
                  }).format(new Date(order.cancellableUntil)),
                })}{' '}
            <span className="btn btn--secondary btn--sm">{w('cancelOrder')}</span>
          </summary>
          <form action={cancelOrder} className="cancel-order__confirm">
            <input type="hidden" name="number" value={order.number} />
            <input type="hidden" name="token" value={token ?? ''} />
            <p style={{ margin: 0 }}>{w('cancelConfirm')}</p>
            <button className="btn btn--danger btn--sm" type="submit">
              {w('cancelOrder')}
            </button>
          </form>
        </details>
      ) : null}

      {order.preorderShipsOn && !order.cancellableUntil ? (
        <p className="banner banner--info">
          {po('shipsFrom', { date: calendarDay(order.preorderShipsOn, locale) })}
        </p>
      ) : null}

      {unpaid ? (
        <p className="banner banner--info">
          {t('notPaidYet')}{' '}
          <Link href={`/checkout/pay/${order.number}${qs}`}>{t('completePayment')}</Link>
        </p>
      ) : null}

      {order.kind !== 'GIFT_CARD' &&
      order.kind !== 'PLUS' &&
      order.status !== 'PENDING_PAYMENT' &&
      order.status !== 'CANCELLED' ? (
        <section className="card stack">
          <OrderTimeline order={order} />
          {order.shipments.length ? (
            <Shipments order={order} token={token} />
          ) : order.tracking ? (
            <p>
              {t('carrierTracking', { carrier: order.tracking.carrier })}{' '}
              <span className="mono">{order.tracking.number}</span>
              {order.tracking.url ? (
                <>
                  {' · '}
                  <a href={order.tracking.url} rel="noopener noreferrer" target="_blank">
                    {t('trackPackage')}
                  </a>
                </>
              ) : null}
            </p>
          ) : null}
          {!order.shipments.length && order.tracking ? (
            <TrackingScans events={order.trackingEvents} />
          ) : !order.shipments.length ? (
            <p className="muted">{t('trackingByEmail')}</p>
          ) : null}
        </section>
      ) : null}

      {returns.length ? (
        <section className="card stack">
          <h2>{t('returns')}</h2>
          {returns.map((r) => (
            <div key={r.id} className="stack" style={{ gap: 4 }}>
              <strong>
                {label(t, 'return', r.status)}
                {r.refundCents
                  ? ` · ${t('refundedAmount', { amount: f.money(r.refundCents) })}`
                  : ''}
              </strong>
              <span className="muted">
                {r.items.map((i) => `${i.quantity} × ${i.productTitle}`).join(', ')} —{' '}
                {label(t, 'reason', r.reason)}
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
            {t('returnsOpenUntil', {
              date: new Intl.DateTimeFormat(INTL_LOCALE[locale], { dateStyle: 'long' }).format(
                new Date(order.returnableUntil),
              ),
            })}
          </p>
        </div>
      ) : null}

      {order.gift && order.kind === 'GOODS' ? (
        <section className="card gift-box" aria-labelledby="gift-title">
          <h2 id="gift-title">{gf('orderTitle')}</h2>
          <p style={{ margin: 0 }}>
            {gf('noPrices')}
            {order.gift.wrapCents ? ` ${gf('wrapped')}.` : ''}
          </p>
          {order.gift.message ? (
            <blockquote className="gift-receipt__message">{order.gift.message}</blockquote>
          ) : null}
          {order.gift.from ? (
            <p className="muted" style={{ margin: 0 }}>
              {gf('fromLine', { from: order.gift.from })}
            </p>
          ) : null}
          <Link href={`/orders/${order.number}/gift-receipt${qs}`}>{gf('receipt')}</Link>
        </section>
      ) : null}

      {!token && order.kind !== 'PLUS' && order.kind !== 'GIFT_CARD' ? (
        <p style={{ margin: 0 }}>
          <Link href={`/help/chat?order=${order.number}`}>{ha('orderHelp')}</Link>
        </p>
      ) : null}

      <div className="two">
        <section className="card summary">
          <h2>{t('items')}</h2>
          <OrderItems order={order} />
          <OrderTotals order={order} />
        </section>
        <section className="card stack">
          {order.kind === 'GIFT_CARD' ? (
            <GiftCardLines order={order} />
          ) : order.kind === 'PLUS' ? (
            <>
              <h2>{pl('orderTitle')}</h2>
              <p className="muted">{pl('orderNote')}</p>
              <Link href="/account/plus">{pl('manage')}</Link>
            </>
          ) : (
            <>
              <h2>{t('shippingTo')}</h2>
              <AddressBlock address={order.shippingAddress} />
            </>
          )}
          {token ? <p className="hint">{t('keepLink')}</p> : null}
        </section>
      </div>
      <Link href="/search">{t('continueShopping')}</Link>
    </div>
  );
}

/** Marketplace orders arrive in parcels: NIXZORA's own items and one per seller. */
async function Shipments({ order, token }: { order: OrderView; token?: string }) {
  const t = await getT('order');
  const d = await getT('delivery');
  const ib = await getT('inbox');
  const locale = await getLocale();
  return (
    <ul className="shipments">
      {order.shipments.map((shipment) => {
        const items = order.items.filter((item) => shipment.itemIds.includes(item.id));
        const seller = shipment.seller;
        return (
          <li key={shipment.seller?.handle ?? 'nixzora'}>
            <div>
              <strong>
                {seller
                  ? rich(t('fromSeller'), {
                      link: () => (
                        <Link key="seller" href={`/s/${seller.handle}`}>
                          {seller.displayName}
                        </Link>
                      ),
                    })
                  : t('fromNixzora')}
              </strong>{' '}
              <span className="muted">· {t(`shipment_${shipment.status}`)}</span>
              {seller && !token ? (
                <>
                  {' · '}
                  <Link
                    href={`/account/messages/new?store=${seller.handle}&order=${order.number}`}
                    style={{ fontSize: 14 }}
                  >
                    {ib('contactStore', { store: seller.displayName })}
                  </Link>
                </>
              ) : null}
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
                      {t('trackPackage')}
                    </a>
                  </>
                ) : null}
              </div>
            ) : null}
            {shipment.tracking ? <TrackingScans events={shipment.events} /> : null}
            {shipment.status !== 'DELIVERED' && shipment.estimatedDelivery ? (
              <div style={{ fontSize: 14 }}>
                {d('expected', { range: deliveryRange(shipment.estimatedDelivery, locale) })}
              </div>
            ) : null}
            {shipment.seller && shipment.ratableUntil ? (
              <RateSellerForm number={order.number} token={token} shipment={shipment} />
            ) : shipment.rating ? (
              <div className="muted" style={{ fontSize: 14 }}>
                {t('ratedSeller', { value: shipment.rating.value })}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
