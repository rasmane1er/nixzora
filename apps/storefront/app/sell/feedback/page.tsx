import { type SellerFeedback } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SellerNav } from '@/components/SellerNav';
import { Stars } from '@/components/Stars';
import { api } from '@/lib/api';
import { requireSeller } from '@/lib/sell';

export const metadata: Metadata = { title: 'Returns and ratings', robots: { index: false } };

const RETURN_LABEL: Record<SellerFeedback['returns'][number]['status'], string> = {
  REQUESTED: 'Requested',
  APPROVED: 'Approved, on its way back',
  REJECTED: 'Rejected',
  RECEIVED: 'Received',
  REFUNDED: 'Refunded',
};

const day = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

/**
 * What customers say (p7-07): the store's rating with private comments, and return requests
 * that include its items. NIXZORA decides returns; refunds of your items show in Earnings.
 */
export default async function SellerFeedbackPage() {
  const seller = await requireSeller('/sell/feedback');
  const feedback = await api<SellerFeedback>('/seller/feedback');
  const { rating } = feedback;
  const open = feedback.returns.filter((r) => r.status === 'REQUESTED' || r.status === 'APPROVED');

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/feedback" />

      <section className="card stack">
        <h2>Your rating</h2>
        {rating.count && rating.average !== null ? (
          <div className="reviews">
            <div className="stack" style={{ gap: 6 }}>
              <strong style={{ fontSize: 32 }}>{rating.average.toFixed(1)}</strong>
              <Stars value={rating.average} />
              <span className="muted" style={{ fontSize: 14 }}>
                From {rating.count} {rating.count === 1 ? 'order' : 'orders'}. Shoppers see the
                average on your store page and listings.
              </span>
            </div>
            <div className="histogram" aria-label="Ratings breakdown">
              {(['5', '4', '3', '2', '1'] as const).map((star) => (
                <div key={star}>
                  <span>{star} star</span>
                  <meter min={0} max={rating.count} value={rating.breakdown[star]} />
                  <span className="muted">{rating.breakdown[star]}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="muted">
            No ratings yet. Customers can rate your store for 60 days after an order is delivered.
          </p>
        )}
      </section>

      <section className="card stack">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>Return requests</h2>
          {open.length ? (
            <span className="pill pill--seller-order-paid">{open.length} open</span>
          ) : null}
        </div>
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          NIXZORA reviews every return. When an approved return arrives, the customer is refunded
          and the amount for your items, less the commission returned to you, is deducted from your{' '}
          <Link href="/sell/earnings">earnings</Link>.
        </p>
        {feedback.returns.length === 0 ? (
          <p className="muted">No returns of your items.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="plain">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Items</th>
                  <th>Reason</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {feedback.returns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="mono">{r.orderNumber}</span>
                      <div className="muted" style={{ fontSize: 13 }}>
                        {day(r.createdAt)}
                      </div>
                    </td>
                    <td>
                      {r.items.map((item) => (
                        <div key={item.orderItemId}>
                          {item.quantity} × {item.productTitle}
                        </div>
                      ))}
                    </td>
                    <td>
                      {r.reason}
                      {r.customerNote ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          “{r.customerNote}”
                        </div>
                      ) : null}
                    </td>
                    <td>
                      {RETURN_LABEL[r.status]}
                      {r.staffNote ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          {r.staffNote}
                        </div>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card stack">
        <h2>Comments from customers</h2>
        <p className="muted" style={{ fontSize: 14, margin: 0 }}>
          Only you and NIXZORA see these.
        </p>
        {feedback.ratings.length === 0 ? (
          <p className="muted">Nothing yet.</p>
        ) : (
          <ul className="shipments">
            {feedback.ratings.map((r) => (
              <li key={r.id}>
                <div className="rating-line">
                  <Stars value={r.rating} size={14} />
                  <span className="muted">
                    <span className="mono">{r.orderNumber}</span> · {day(r.updatedAt)}
                  </span>
                </div>
                {r.comment ? <p style={{ margin: 0 }}>{r.comment}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
