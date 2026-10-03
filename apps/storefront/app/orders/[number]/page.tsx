import { INTL_LOCALE, type MessageKey, rich } from '@nixzora/i18n';
import { type OrderView, type ReturnView } from '@nixzora/validation';
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
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { RateSellerForm } from './RateSellerForm';
import { ReturnForm } from './ReturnForm';

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
  const f = await getFormat();
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

      {unpaid ? (
        <p className="banner banner--info">
          {t('notPaidYet')}{' '}
          <Link href={`/checkout/pay/${order.number}${qs}`}>{t('completePayment')}</Link>
        </p>
      ) : null}

      {order.status !== 'PENDING_PAYMENT' && order.status !== 'CANCELLED' ? (
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
          ) : (
            <p className="muted">{t('trackingByEmail')}</p>
          )}
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

      <div className="two">
        <section className="card summary">
          <h2>{t('items')}</h2>
          <OrderItems order={order} />
          <OrderTotals order={order} />
        </section>
        <section className="card stack">
          <h2>{t('shippingTo')}</h2>
          <AddressBlock address={order.shippingAddress} />
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
