import { rich } from '@nixzora/i18n';
import { type SupportRequestView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('accountActivity');
  return { title: t('supportTitle'), robots: { index: false } };
}

const STATUS = {
  OPEN: { text: 'supportStatus_OPEN', pill: 'pill--pending_payment' },
  ANSWERED: { text: 'supportStatus_ANSWERED', pill: 'pill--delivered' },
  CLOSED: { text: 'supportStatus_CLOSED', pill: '' },
} as const;

export default async function SupportRequestsPage() {
  const [requests, t, f] = await Promise.all([
    accountApi<SupportRequestView[]>('/me/support-requests', '/account/support'),
    getT('accountActivity'),
    getFormat(),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title={t('supportTitle')}
        description={t('supportDescription')}
        actions={
          <Link className="btn btn--primary" href="/help/contact">
            {t('contactSupport')}
          </Link>
        }
      />
      {requests.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>
            {rich(t('supportEmpty'), {
              link: (chunk) => (
                <Link key="help" href="/help">
                  {chunk}
                </Link>
              ),
            })}
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
                    <span className="mono">{r.reference}</span> · {t(`topic_${r.topic}`)} ·{' '}
                    {f.date(r.createdAt)}
                    {r.orderNumber ? (
                      <>
                        {' '}
                        · <Link href={`/orders/${r.orderNumber}`}>{r.orderNumber}</Link>
                      </>
                    ) : null}
                  </span>
                </div>
                <span className={`pill ${STATUS[r.status].pill}`}>{t(STATUS[r.status].text)}</span>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-line' }}>{r.message}</p>
              {r.staffReply ? (
                <div className="banner banner--info" style={{ margin: 0, whiteSpace: 'pre-line' }}>
                  <strong>
                    {r.answeredAt ? t('replyByOn', { date: f.date(r.answeredAt) }) : t('replyBy')}
                  </strong>{' '}
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
