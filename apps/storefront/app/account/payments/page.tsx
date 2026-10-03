import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('account');
  return { title: t('paymentMethods'), robots: { index: false } };
}

/**
 * NIXZORA does not keep cards: they are entered on the payment provider's secure form at
 * checkout. This page says so plainly and lists the ways to pay.
 */
export default async function PaymentsPage() {
  await accountApi('/me/profile', '/account/payments');
  const t = await getT('account');
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 820 }}>
      <AccountHeader title={t('paymentMethods')} description={t('paymentsDescription')} />
      <section className="card stack">
        <h2>{t('waysToPay')}</h2>
        <ul className="pay-list">
          <li>
            <strong>{t('cards')}</strong>
            <span className="muted">{t('cardBrands')}</span>
          </li>
          <li>
            <strong>{t('wallets')}</strong>
            <span className="muted">{t('walletsHint')}</span>
          </li>
        </ul>
      </section>
      <section className="card stack">
        <h2>{t('noSavedCards')}</h2>
        <p style={{ margin: 0 }}>{t('noSavedCardsText')}</p>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {rich(t('refundsNote'), {
            link: (chunk) => (
              <Link key="returns" href="/account/returns">
                {chunk}
              </Link>
            ),
          })}
        </p>
      </section>
    </div>
  );
}
