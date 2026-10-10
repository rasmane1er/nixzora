import {
  CARRIERS,
  type OrderView,
  type PagedResult,
  type ReturnView,
  type RiskAssessmentView,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, PageHeader, StatusPill } from '@/components/ui';
import { ApiError, load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { param, type SearchParams } from '@/lib/format';
import { isUuid } from '@/lib/forms';
import { getFormat, getT } from '@/lib/i18n';
import { buyLabel, fulfill, refund } from '../actions';
import { ReturnList } from '../../returns/ReturnList';
import { RiskList } from '../../risk/RiskList';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsOrders');
  return { title: t('metaOrder') };
}

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const search = await searchParams;
  if (!isUuid(id)) notFound();
  const me = await currentStaff();
  const [t, tOrder, f] = await Promise.all([getT('opsOrders'), getT('order'), getFormat()]);
  const money = f.money;
  let order: OrderView;
  try {
    order = await load<OrderView>(`/admin/orders/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canFulfill = can(me, 'orders.fulfill');
  const returns = await load<ReturnView[]>(`/admin/orders/${id}/returns`);
  const canReviewRisk = can(me, 'risk.review');
  const risk = canReviewRisk
    ? (await load<PagedResult<RiskAssessmentView>>(`/admin/risk?orderId=${id}`)).items
    : [];
  const held = risk.some((r) => r.order?.riskHold);
  const tRisk = await getT('opsRisk');
  const tGift = await getT('gift');
  const refundable = ['PAID', 'FULFILLING', 'SHIPPED', 'DELIVERED', 'PARTIALLY_REFUNDED'].includes(
    order.status,
  );
  const remaining = order.totalCents - order.refundedCents;
  const label = await load<{
    labelUrl: string | null;
    postageCents: number | null;
    provider: string;
  }>(`/admin/orders/${id}/shipping`).catch(() => null);
  const open = ['PAID', 'FULFILLING'].includes(order.status);
  // Marketplace orders: staff ship only NIXZORA's own items; sellers ship theirs.
  const ownPart = order.shipments.find((part) => !part.seller);
  // Held by a fraud review: no packing or shipping until it is cleared (cancelling still works).
  const shipOwn = open && !held && (!order.shipments.length || ownPart?.status === 'PROCESSING');
  const a = order.shippingAddress;
  const statusLabel = (status: string) => {
    const key = `status_${status}`;
    const label = tOrder(key as never);
    return label === key ? status.replace('_', ' ').toLowerCase() : label;
  };

  return (
    <>
      <PageHeader
        eyebrow={t('orderEyebrow', { email: order.email })}
        title={order.number}
        actions={
          <>
            <StatusPill value={order.status} />
            <Link className="btn btn--secondary" href="/orders">
              {t('allOrders')}
            </Link>
          </>
        }
      />
      <Banner notice={param(search, 'notice')} error={param(search, 'error')} />
      {held ? (
        <p className="banner banner--error" role="alert">
          {tRisk('orderHeld')}
        </p>
      ) : null}
      {/* Gift options (p10-22): what the packer needs to know. */}
      {order.gift ? (
        <div className="banner banner--info" style={{ display: 'grid', gap: 4 }}>
          <strong>{tGift('opsGift')}</strong>
          {order.gift.wrapCents ? (
            <span>
              {tGift('opsWrap', { price: f.money(order.gift.wrapCents, order.currency) })}
            </span>
          ) : null}
          {order.gift.message ? (
            <span>{tGift('opsMessage', { message: order.gift.message })}</span>
          ) : null}
          {order.gift.from ? <span>{tGift('fromLine', { from: order.gift.from })}</span> : null}
        </div>
      ) : null}
      {risk.some((r) => r.status) ? (
        <section style={{ marginBottom: 16 }}>
          <h2>{tRisk('metaRisk')}</h2>
          <RiskList
            reviews={risk.filter((r) => r.status)}
            canReview={canReviewRisk}
            back={`/orders/${id}`}
          />
        </section>
      ) : null}

      <div className="two-col">
        <div>
          <section className="card">
            <h2>{t('items')}</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('colSku')}</th>
                    <th>{t('colProduct')}</th>
                    <th className="num">{t('colQty')}</th>
                    <th className="num">{t('colPrice')}</th>
                    <th className="num">{t('colTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.sku}>
                      <td className="mono">{item.sku}</td>
                      <td>
                        {item.productTitle}
                        <div className="muted">{item.variantTitle}</div>
                      </td>
                      <td className="num">{item.quantity}</td>
                      <td className="num">{money(item.unitPriceCents, order.currency)}</td>
                      <td className="num">{money(item.totalCents, order.currency)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={4} className="num muted">
                      {order.discountCents
                        ? t('totalsBreakdownDiscount', { code: order.couponCode ?? '' })
                        : t('totalsBreakdown')}
                    </td>
                    <td className="num">
                      {money(order.subtotalCents, order.currency)}
                      {order.discountCents ? (
                        <>
                          <br />−{money(order.discountCents, order.currency)}
                        </>
                      ) : null}
                      <br />
                      {money(order.shippingCents, order.currency)}
                      <br />
                      {money(order.taxCents, order.currency)}
                    </td>
                  </tr>
                  <tr>
                    <td colSpan={4} className="num">
                      <strong>{t('totalCharged')}</strong>
                    </td>
                    <td className="num">
                      <strong>{money(order.totalCents, order.currency)}</strong>
                    </td>
                  </tr>
                  {order.refundedCents ? (
                    <tr>
                      <td colSpan={4} className="num">
                        {t('refundedSoFar')}
                      </td>
                      <td className="num low">−{money(order.refundedCents, order.currency)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {order.shipments.length ? (
            <section className="card">
              <h2>{t('shipments')}</h2>
              <p className="muted">{t('shipmentsHint')}</p>
              <div className="table-wrap">
                <table>
                  <tbody>
                    {order.shipments.map((part) => (
                      <tr key={part.seller?.handle ?? 'nixzora'}>
                        <td>
                          <strong>{part.seller?.displayName ?? 'NIXZORA'}</strong>
                          <div className="muted">
                            {order.items
                              .filter((item) => part.itemIds.includes(item.id))
                              .map((item) => `${item.quantity} × ${item.sku}`)
                              .join(', ')}
                          </div>
                        </td>
                        <td>
                          <StatusPill value={part.status} />
                        </td>
                        <td>
                          {part.tracking ? (
                            <>
                              {part.tracking.carrier}{' '}
                              <span className="mono">{part.tracking.number}</span>
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}

          {canFulfill &&
          (open || order.status === 'SHIPPED' || order.status === 'PENDING_PAYMENT') ? (
            <section className="card">
              <h2>{t('fulfillment')}</h2>
              <div className="form">
                {order.status === 'PAID' && !held ? (
                  <ActionButton
                    action={fulfill}
                    label={t('startPacking')}
                    fields={{ id: order.id, action: 'start' }}
                  />
                ) : null}
                {shipOwn && label?.provider !== 'NONE' ? (
                  <form action={buyLabel} className="inline-form" style={{ flexWrap: 'wrap' }}>
                    <input type="hidden" name="id" value={order.id} />
                    <span className="muted">{t('boxInches')}</span>
                    <input
                      name="lengthIn"
                      defaultValue={18}
                      aria-label={t('lengthInches')}
                      style={{ width: 60 }}
                    />
                    <input
                      name="widthIn"
                      defaultValue={14}
                      aria-label={t('widthInches')}
                      style={{ width: 60 }}
                    />
                    <input
                      name="heightIn"
                      defaultValue={4}
                      aria-label={t('heightInches')}
                      style={{ width: 60 }}
                    />
                    <span className="muted">{t('weightOz')}</span>
                    <input
                      name="weightOz"
                      defaultValue={96}
                      aria-label={t('weightOunces')}
                      style={{ width: 70 }}
                    />
                    <SubmitButton>{t('buyLabelAndShip')}</SubmitButton>
                  </form>
                ) : null}
                {shipOwn ? (
                  <form action={fulfill} className="inline-form" style={{ flexWrap: 'wrap' }}>
                    <span className="muted">{t('orEnterTracking')}</span>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="action" value="ship" />
                    <select name="carrier" aria-label={t('carrier')} defaultValue="UPS">
                      {CARRIERS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      name="trackingNumber"
                      required
                      placeholder={t('trackingNumber')}
                      aria-label={t('trackingNumber')}
                      style={{ width: 220 }}
                    />
                    <SubmitButton>{t('markShipped')}</SubmitButton>
                  </form>
                ) : null}
                {order.status === 'SHIPPED' ? (
                  <ActionButton
                    action={fulfill}
                    label={t('markDelivered')}
                    fields={{ id: order.id, action: 'deliver' }}
                  />
                ) : null}
                {open || order.status === 'PENDING_PAYMENT' ? (
                  <details>
                    <summary>{open ? t('cancelOrderAndRefund') : t('cancelOrder')}</summary>
                    <form
                      action={fulfill}
                      className="inline-form"
                      style={{ marginTop: 10, flexWrap: 'wrap' }}
                    >
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="action" value="cancel" />
                      <input
                        name="reason"
                        required
                        minLength={3}
                        placeholder={t('cancelReasonPlaceholder')}
                        aria-label={t('reason')}
                        style={{ width: 280 }}
                      />
                      <SubmitButton tone="danger">
                        {open
                          ? t('cancelAndRefundAmount', {
                              amount: money(order.totalCents, order.currency),
                            })
                          : t('cancelOrder')}
                      </SubmitButton>
                    </form>
                  </details>
                ) : null}
              </div>
            </section>
          ) : null}
          {can(me, 'orders.refund') && refundable && remaining > 0 ? (
            <section className="card">
              <h2>{t('refundTitle')}</h2>
              <p className="muted">
                {t('refundHint', { amount: money(remaining, order.currency) })}
              </p>
              <form action={refund} className="inline-form" style={{ flexWrap: 'wrap' }}>
                <input type="hidden" name="id" value={order.id} />
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  placeholder="25.00"
                  aria-label={t('amountInDollars')}
                  style={{ width: 110 }}
                />
                <input
                  name="reason"
                  required
                  minLength={3}
                  placeholder={t('refundReasonPlaceholder')}
                  aria-label={t('reason')}
                  style={{ width: 280 }}
                />
                <SubmitButton tone="secondary">{t('refundButton')}</SubmitButton>
              </form>
            </section>
          ) : null}

          {returns.length ? (
            <section className="card">
              <h2>{t('returnsTitle')}</h2>
              <ReturnList returns={returns} canDecide={canFulfill} back={`/orders/${order.id}`} />
            </section>
          ) : null}
        </div>

        <div>
          <section className="card">
            <h2>{t('shipTo')}</h2>
            <p>
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
              {a.phone ? (
                <>
                  <br />
                  <span className="muted">{a.phone}</span>
                </>
              ) : null}
            </p>
            {label?.labelUrl ? (
              <p>
                <a
                  className="btn btn--secondary"
                  href={label.labelUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {t('printLabel')}
                </a>{' '}
                {label.postageCents ? (
                  <span className="muted">
                    {t('postage', { amount: money(label.postageCents) })}
                  </span>
                ) : null}
              </p>
            ) : null}
            {order.tracking ? (
              <p>
                {order.tracking.carrier} <span className="mono">{order.tracking.number}</span>
                {order.tracking.url ? (
                  <>
                    {' · '}
                    <a href={order.tracking.url} target="_blank" rel="noopener noreferrer">
                      {t('track')}
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </section>
          <section className="card">
            <h2>{t('history')}</h2>
            <ul className="activity">
              {order.timeline.map((entry) => (
                <li key={entry.status}>
                  <span>{statusLabel(entry.status)}</span>
                  <span className="muted">{f.dateTime(entry.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
