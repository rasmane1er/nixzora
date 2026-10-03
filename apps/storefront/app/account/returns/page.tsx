import { type ReturnView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { rich } from '@nixzora/i18n';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi, returnStatusText } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('accountActivity');
  return { title: t('returnsTitle'), robots: { index: false } };
}

const STEPS = ['REQUESTED', 'APPROVED', 'RECEIVED', 'REFUNDED'] as const;

export default async function ReturnsPage() {
  const [returns, t, f] = await Promise.all([
    accountApi<ReturnView[]>('/me/returns', '/account/returns'),
    getT('accountActivity'),
    getFormat(),
  ]);

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title={t('returnsTitle')}
        description={t('returnsDescription')}
        actions={
          <Link className="btn btn--secondary" href="/account/orders?filter=delivered">
            {t('startReturn')}
          </Link>
        }
      />

      {returns.length === 0 ? (
        <div className="card stack" style={{ gap: 8 }}>
          <p style={{ margin: 0 }}>{t('noReturns')}</p>
          <p className="muted" style={{ margin: 0 }}>
            {rich(t('noReturnsHelp'), {
              link: (chunk) => (
                <Link key="orders" href="/account/orders">
                  {chunk}
                </Link>
              ),
            })}
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
                    <strong>{returnStatusText(t, r.status)}</strong>
                    <span className="muted" style={{ fontSize: 14 }}>
                      {rich(
                        t('returnOrderLine', { number: r.orderNumber, date: f.date(r.createdAt) }),
                        {
                          link: (chunk) => (
                            <Link key="order" href={`/orders/${r.orderNumber}`}>
                              {chunk}
                            </Link>
                          ),
                        },
                      )}
                    </span>
                  </div>
                  {r.refundCents ? (
                    <strong>
                      {t('refundedAmount', { amount: f.money(r.refundCents, 'USD') })}
                    </strong>
                  ) : null}
                </div>
                {r.status !== 'REJECTED' ? (
                  <ol className="return-steps" aria-label={t('progressLabel')}>
                    {STEPS.map((step, i) => (
                      <li key={step} data-done={i <= reached || undefined}>
                        {t(`returnStep_${step}`)}
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
                  {t('reason', { reason: r.reason })}
                  {r.customerNote ? ` · “${r.customerNote}”` : ''}
                </p>
                {r.staffNote ? (
                  <p className="banner banner--info" style={{ margin: 0 }}>
                    {t('fromNixzora', { note: r.staffNote })}
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
