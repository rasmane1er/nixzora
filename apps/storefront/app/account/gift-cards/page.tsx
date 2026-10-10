import { type GiftBalanceView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';
import { RedeemForm } from './RedeemForm';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('gifts');
  return { title: t('balanceTitle'), robots: { index: false } };
}

/** Gift card balance, redeeming codes and the activity (p10-10). */
export default async function GiftBalancePage() {
  const [view, t, f] = await Promise.all([
    accountApi<GiftBalanceView>('/me/gift-cards', '/account/gift-cards'),
    getT('gifts'),
    getFormat(),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 820 }}>
      <AccountHeader
        title={t('balanceTitle')}
        description={t('balanceHint')}
        actions={
          <Link href="/gift-cards" className="btn btn--secondary">
            {t('buyOne')}
          </Link>
        }
      />
      <section className="card gift-balance">
        <span className="muted">{t('balanceTitle')}</span>
        <strong>{f.money(view.balanceCents)}</strong>
      </section>
      <RedeemForm />
      <section className="card stack">
        <h2>{t('history')}</h2>
        {view.entries.length ? (
          <ul className="gift-history">
            {view.entries.map((entry) => (
              <li key={entry.id}>
                <span>
                  {t(`kind_${entry.kind}`, { number: entry.orderNumber ?? '' })}
                  {entry.note ? <span className="muted"> · {entry.note}</span> : null}
                  <span className="muted" style={{ display: 'block', fontSize: 13 }}>
                    {f.date(entry.createdAt)}
                  </span>
                </span>
                <span className={entry.amountCents < 0 ? '' : 'gift-history__plus'}>
                  {entry.amountCents < 0 ? '−' : '+'}
                  {f.money(Math.abs(entry.amountCents))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t('noHistory')}</p>
        )}
      </section>
    </div>
  );
}
