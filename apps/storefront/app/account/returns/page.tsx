import { type ReturnView } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { RETURN_STATUS_TEXT, accountApi, day } from '@/lib/account';

export const metadata: Metadata = { title: 'Returns & refunds', robots: { index: false } };

const STEPS = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED'] as const;

export default async function ReturnsPage() {
  const returns = await accountApi<ReturnView[]>('/me/returns', '/account/returns');

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title="Returns & refunds"
        description="Most items can be returned within 30 days of delivery. Refunds go back to the card you paid with."
        actions={
          <Link className="btn btn--secondary" href="/account/orders?filter=delivered">
            Start a return
          </Link>
        }
      />

      {returns.length === 0 ? (
        <div className="card stack" style={{ gap: 8 }}>
          <p style={{ margin: 0 }}>You have no returns.</p>
          <p className="muted" style={{ margin: 0 }}>
            To return something, open the order in <Link href="/account/orders">Your orders</Link>{' '}
            and choose “Return or replace items”.
          </p>
        </div>
      ) : (
        <ul className="return-list">
          {returns.map((r) => {
            const reached =
              r.status === 'REJECTED' ? -1 : STEPS.indexOf(r.status as (typeof STEPS)[number]);
            return (
              <li key={r.id} className="card stack" style={{ gap: 12 }}>
                <div className="section-head" style={{ marginBottom: 0 }}>
                  <div className="stack" style={{ gap: 2 }}>
                    <strong>{RETURN_STATUS_TEXT[r.status] ?? r.status}</strong>
                    <span className="muted" style={{ fontSize: 14 }}>
                      Order <Link href={`/orders/${r.orderNumber}`}>{r.orderNumber}</Link> ·
                      requested {day(r.createdAt)}
                    </span>
                  </div>
                  {r.refundCents ? (
                    <strong>Refunded {formatMoney(r.refundCents, 'USD')}</strong>
                  ) : null}
                </div>
                {r.status !== 'REJECTED' ? (
                  <ol className="return-steps" aria-label="Progress">
                    {STEPS.map((step, i) => (
                      <li key={step} data-done={i <= reached || undefined}>
                        {RETURN_STATUS_TEXT[step]!.split(':')[0]}
                      </li>
                    ))}
                  </ol>
                ) : null}
                <ul className="muted" style={{ margin: 0, paddingLeft: 18 }}>
                  {r.items.map((item) => (
                    <li key={item.orderItemId}>
                      {item.quantity} × {item.productTitle}
                    </li>
                  ))}
                </ul>
                <p style={{ margin: 0, fontSize: 14 }}>
                  Reason: {r.reason}
                  {r.customerNote ? ` · “${r.customerNote}”` : ''}
                </p>
                {r.staffNote ? (
                  <p className="banner banner--info" style={{ margin: 0 }}>
                    From NIXZORA: {r.staffNote}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
