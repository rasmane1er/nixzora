import { type ReturnView } from '@nixzora/validation';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { StatusPill } from '@/components/ui';
import { dateTime, money } from '@/lib/format';
import { decideReturn } from '../orders/actions';

/** Return requests with the next step for each (approve/reject, then receive & refund). */
export function ReturnList({
  returns,
  canDecide,
  back,
  showOrder = false,
}: {
  returns: ReturnView[];
  canDecide: boolean;
  back: string;
  showOrder?: boolean;
}) {
  return (
    <div className="stack">
      {returns.map((r) => (
        <article key={r.id} className="card" style={{ marginBottom: 12 }}>
          <div className="page-header" style={{ marginBottom: 8 }}>
            <div>
              {showOrder ? (
                <Link className="mono" href={`/orders/${r.orderId}`}>
                  {r.orderNumber}
                </Link>
              ) : null}{' '}
              <StatusPill value={r.status} /> <span className="muted">{dateTime(r.createdAt)}</span>
            </div>
            {r.refundCents ? <strong>{money(r.refundCents)} refunded</strong> : null}
          </div>
          <p>
            <strong>{r.reason}</strong>
            {r.customerNote ? <span className="muted"> — “{r.customerNote}”</span> : null}
          </p>
          <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
            {r.items.map((item) => (
              <li key={item.orderItemId}>
                {item.quantity} × {item.productTitle} <span className="mono muted">{item.sku}</span>
              </li>
            ))}
          </ul>
          {r.staffNote ? <p className="muted">Staff note: {r.staffNote}</p> : null}
          {canDecide && r.status === 'REQUESTED' ? (
            <div className="inline-form" style={{ flexWrap: 'wrap', gap: 10 }}>
              <form action={decideReturn} className="inline-form">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="action" value="approve" />
                <SubmitButton>Approve</SubmitButton>
              </form>
              <form action={decideReturn} className="inline-form">
                <input type="hidden" name="id" value={r.id} />
                <input type="hidden" name="back" value={back} />
                <input type="hidden" name="action" value="reject" />
                <input
                  name="note"
                  required
                  minLength={3}
                  placeholder="Why (emailed)"
                  aria-label="Reason for rejecting"
                  style={{ width: 200 }}
                />
                <SubmitButton tone="danger">Reject</SubmitButton>
              </form>
            </div>
          ) : null}
          {canDecide && r.status === 'APPROVED' ? (
            <form action={decideReturn} className="inline-form" style={{ flexWrap: 'wrap' }}>
              <input type="hidden" name="id" value={r.id} />
              <input type="hidden" name="back" value={back} />
              <input type="hidden" name="action" value="receive" />
              <label className="check">
                <input type="checkbox" name="restock" defaultChecked /> Items can be resold
                (restock)
              </label>
              <SubmitButton>Mark received &amp; refund</SubmitButton>
            </form>
          ) : null}
        </article>
      ))}
    </div>
  );
}
