import { CARRIERS, type SellerOrderView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api, ApiError } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { shipSellerOrder } from '../../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellerTools');
  return { title: t('metaOrder'), robots: { index: false } };
}

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
  const [t, f] = await Promise.all([getT('sellerTools'), getFormat()]);
  const money = (cents: number) => f.money(cents, order.currency);
  const date = (iso: string | null) => (iso ? f.dateTime(iso) : '—');
  const a = order.shipTo;

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/orders" />
      <Notices notice={param(search, 'notice')} error={param(search, 'error')} />

      <section className="card stack">
        <p className="eyebrow">
          <Link href="/sell/orders">{t('breadcrumbOrders')}</Link>
        </p>
        <h2 className="mono">{order.orderNumber}</h2>
        <p>
          <span className={`pill pill--seller-order-${order.status.toLowerCase()}`}>
            {t(`order_${order.status}`)}
          </span>{' '}
          <span className="muted">{t('placedOn', { date: date(order.placedAt) })}</span>
        </p>
        {order.underReview ? (
          <p className="banner banner--error" role="alert">
            {t('underReviewDoNotShip')}
          </p>
        ) : order.status === 'PAID' ? (
          <p className="banner banner--info">{t('shipWithin')}</p>
        ) : order.awaitingCarrierScan ? (
          <p className="banner banner--info">{t('awaitingCarrierScan')}</p>
        ) : null}
        {order.status === 'CANCELLED' ? (
          <p className="banner banner--error">{t('cancelledDoNotShip')}</p>
        ) : null}
      </section>

      <div className="two-col-sell">
        <section className="card stack">
          <h2>{t('itemsToShip')}</h2>
          <div className="table-scroll">
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
          </div>
          <h3>{t('shipTo')}</h3>
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
          <h2>{t('yourEarnings')}</h2>
          <dl className="facts">
            <dt>{t('factItems')}</dt>
            <dd>{money(order.itemsCents)}</dd>
            <dt>{t('factShipping')}</dt>
            <dd>{order.shippingCents ? money(order.shippingCents) : t('freeShipping')}</dd>
            <dt>{t('factCommission', { rate: f.percent(order.commissionBps / 10000) })}</dt>
            <dd>−{money(order.commissionCents)}</dd>
            {order.refundedCents ? (
              <>
                <dt>{t('factRefunded')}</dt>
                <dd>−{money(order.refundedCents)}</dd>
              </>
            ) : null}
            <dt>
              <strong>{t('youEarn')}</strong>
            </dt>
            <dd>
              <strong>{money(order.netCents)}</strong>
              {order.refundedCents ? <span className="muted"> {t('beforeRefunds')}</span> : null}
            </dd>
          </dl>
          <p className="muted" style={{ fontSize: 14 }}>
            {t('earningsAfterHold', { days: seller.payoutHoldDays })}
          </p>

          {order.status === 'PAID' && !order.underReview ? (
            <form action={shipSellerOrder} className="form">
              <h3>{t('markAsShipped')}</h3>
              <input type="hidden" name="id" value={order.id} />
              <div className="form-row">
                <label>
                  {t('fieldCarrier')}
                  <select name="carrier" required defaultValue="">
                    <option value="" disabled>
                      {t('choose')}
                    </option>
                    {CARRIERS.map((carrier) => (
                      <option key={carrier}>{carrier}</option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('fieldTracking')}
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
                  {t('markAsShipped')}
                </button>
              </div>
            </form>
          ) : order.tracking ? (
            <p>
              {t('shippedWith', { date: date(order.shippedAt), carrier: order.tracking.carrier })}{' '}
              <span className="mono">{order.tracking.number}</span>
              {order.tracking.url ? (
                <>
                  {' · '}
                  <a href={order.tracking.url} rel="noopener noreferrer" target="_blank">
                    {t('track')}
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
