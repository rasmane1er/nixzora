import { CARRIERS, type OrderView, type ReturnView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, PageHeader, StatusPill } from '@/components/ui';
import { ApiError, load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { dateTime, money, param, type SearchParams } from '@/lib/format';
import { buyLabel, fulfill, refund } from '../actions';
import { ReturnList } from '../../returns/ReturnList';

export const metadata: Metadata = { title: 'Order' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function OrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const search = await searchParams;
  if (!UUID.test(id)) notFound();
  const me = await currentStaff();
  let order: OrderView;
  try {
    order = await load<OrderView>(`/admin/orders/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const canFulfill = can(me, 'orders.fulfill');
  const returns = await load<ReturnView[]>(`/admin/orders/${id}/returns`);
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
  const a = order.shippingAddress;

  return (
    <>
      <PageHeader
        eyebrow={`Order · ${order.email}`}
        title={order.number}
        actions={
          <>
            <StatusPill value={order.status} />
            <Link className="btn btn--secondary" href="/orders">
              All orders
            </Link>
          </>
        }
      />
      <Banner notice={param(search, 'notice')} error={param(search, 'error')} />

      <div className="two-col">
        <div>
          <section className="card">
            <h2>Items</h2>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th className="num">Qty</th>
                    <th className="num">Price</th>
                    <th className="num">Total</th>
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
                      Subtotal{order.discountCents ? ` · discount (${order.couponCode})` : ''} ·
                      shipping · tax
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
                      <strong>Total charged</strong>
                    </td>
                    <td className="num">
                      <strong>{money(order.totalCents, order.currency)}</strong>
                    </td>
                  </tr>
                  {order.refundedCents ? (
                    <tr>
                      <td colSpan={4} className="num">
                        Refunded so far
                      </td>
                      <td className="num low">−{money(order.refundedCents, order.currency)}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          {canFulfill &&
          (open || order.status === 'SHIPPED' || order.status === 'PENDING_PAYMENT') ? (
            <section className="card">
              <h2>Fulfillment</h2>
              <div className="form">
                {order.status === 'PAID' ? (
                  <ActionButton
                    action={fulfill}
                    label="Start packing"
                    fields={{ id: order.id, action: 'start' }}
                  />
                ) : null}
                {open && label?.provider !== 'NONE' ? (
                  <form action={buyLabel} className="inline-form" style={{ flexWrap: 'wrap' }}>
                    <input type="hidden" name="id" value={order.id} />
                    <span className="muted">Box (in)</span>
                    <input
                      name="lengthIn"
                      defaultValue={18}
                      aria-label="Length in inches"
                      style={{ width: 60 }}
                    />
                    <input
                      name="widthIn"
                      defaultValue={14}
                      aria-label="Width in inches"
                      style={{ width: 60 }}
                    />
                    <input
                      name="heightIn"
                      defaultValue={4}
                      aria-label="Height in inches"
                      style={{ width: 60 }}
                    />
                    <span className="muted">Weight (oz)</span>
                    <input
                      name="weightOz"
                      defaultValue={96}
                      aria-label="Weight in ounces"
                      style={{ width: 70 }}
                    />
                    <SubmitButton>Buy label &amp; ship</SubmitButton>
                  </form>
                ) : null}
                {open ? (
                  <form action={fulfill} className="inline-form" style={{ flexWrap: 'wrap' }}>
                    <span className="muted">Or enter tracking yourself:</span>
                    <input type="hidden" name="id" value={order.id} />
                    <input type="hidden" name="action" value="ship" />
                    <select name="carrier" aria-label="Carrier" defaultValue="UPS">
                      {CARRIERS.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <input
                      name="trackingNumber"
                      required
                      placeholder="Tracking number"
                      aria-label="Tracking number"
                      style={{ width: 220 }}
                    />
                    <SubmitButton>Mark as shipped</SubmitButton>
                  </form>
                ) : null}
                {order.status === 'SHIPPED' ? (
                  <ActionButton
                    action={fulfill}
                    label="Mark as delivered"
                    fields={{ id: order.id, action: 'deliver' }}
                  />
                ) : null}
                {open || order.status === 'PENDING_PAYMENT' ? (
                  <details>
                    <summary>Cancel order{open ? ' and refund' : ''}</summary>
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
                        placeholder="Reason (shown in the audit log)"
                        aria-label="Reason"
                        style={{ width: 280 }}
                      />
                      <SubmitButton tone="danger">
                        {open
                          ? `Cancel and refund ${money(order.totalCents, order.currency)}`
                          : 'Cancel order'}
                      </SubmitButton>
                    </form>
                  </details>
                ) : null}
              </div>
            </section>
          ) : null}
          {can(me, 'orders.refund') && refundable && remaining > 0 ? (
            <section className="card">
              <h2>Refund</h2>
              <p className="muted">
                Up to {money(remaining, order.currency)} left to refund. Full refunds of unshipped
                orders: use Cancel above.
              </p>
              <form action={refund} className="inline-form" style={{ flexWrap: 'wrap' }}>
                <input type="hidden" name="id" value={order.id} />
                <input
                  name="amount"
                  required
                  inputMode="decimal"
                  placeholder="25.00"
                  aria-label="Amount in dollars"
                  style={{ width: 110 }}
                />
                <input
                  name="reason"
                  required
                  minLength={3}
                  placeholder="Reason (emailed to the customer)"
                  aria-label="Reason"
                  style={{ width: 280 }}
                />
                <SubmitButton tone="secondary">Refund</SubmitButton>
              </form>
            </section>
          ) : null}

          {returns.length ? (
            <section className="card">
              <h2>Returns</h2>
              <ReturnList returns={returns} canDecide={canFulfill} back={`/orders/${order.id}`} />
            </section>
          ) : null}
        </div>

        <div>
          <section className="card">
            <h2>Ship to</h2>
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
                  Print label
                </a>{' '}
                {label.postageCents ? (
                  <span className="muted">Postage {money(label.postageCents)}</span>
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
                      Track
                    </a>
                  </>
                ) : null}
              </p>
            ) : null}
          </section>
          <section className="card">
            <h2>History</h2>
            <ul className="activity">
              {order.timeline.map((entry) => (
                <li key={entry.status}>
                  <span>{entry.status.replace('_', ' ').toLowerCase()}</span>
                  <span className="muted">{dateTime(entry.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </>
  );
}
