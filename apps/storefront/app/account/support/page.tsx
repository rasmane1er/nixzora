import { SUPPORT_TOPIC_LABEL, type SupportRequestView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi, day } from '@/lib/account';

export const metadata: Metadata = { title: 'Your support requests', robots: { index: false } };

const STATUS = {
  OPEN: { text: 'Waiting for us', pill: 'pill--pending_payment' },
  ANSWERED: { text: 'Answered', pill: 'pill--delivered' },
  CLOSED: { text: 'Closed', pill: '' },
} as const;

export default async function SupportRequestsPage() {
  const requests = await accountApi<SupportRequestView[]>(
    '/me/support-requests',
    '/account/support',
  );
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title="Your support requests"
        description="We answer within one business day, by email."
        actions={
          <Link className="btn btn--primary" href="/help/contact">
            Contact support
          </Link>
        }
      />
      {requests.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            You have not contacted us yet. Many answers are in the{' '}
            <Link href="/help">help center</Link>.
          </p>
        </div>
      ) : (
        <ul className="return-list">
          {requests.map((r) => (
            <li key={r.id} className="card stack" style={{ gap: 8 }}>
              <div className="section-head" style={{ marginBottom: 0 }}>
                <div className="stack" style={{ gap: 2 }}>
                  <strong>{r.subject}</strong>
                  <span className="muted" style={{ fontSize: 14 }}>
                    <span className="mono">{r.reference}</span> · {SUPPORT_TOPIC_LABEL[r.topic]} ·{' '}
                    {day(r.createdAt)}
                    {r.orderNumber ? (
                      <>
                        {' '}
                        · <Link href={`/orders/${r.orderNumber}`}>{r.orderNumber}</Link>
                      </>
                    ) : null}
                  </span>
                </div>
                <span className={`pill ${STATUS[r.status].pill}`}>{STATUS[r.status].text}</span>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{r.message}</p>
              {r.staffReply ? (
                <div className="banner banner--info" style={{ margin: 0, whiteSpace: 'pre-line' }}>
                  <strong>NIXZORA{r.answeredAt ? `, ${day(r.answeredAt)}` : ''}:</strong>{' '}
                  {r.staffReply}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
