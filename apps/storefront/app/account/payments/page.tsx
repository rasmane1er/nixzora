import { cardBrand, rich } from '@nixzora/i18n';
import { type PaymentCardView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { makeDefault, removeCard } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('account');
  return { title: t('paymentMethods'), robots: { index: false } };
}

/**
 * Saved cards (p10-09): the cards a customer chose to keep for 1-click. The numbers stay with the
 * payment provider; this page shows brand, last four digits and expiry, and the ways to pay.
 */
export default async function PaymentsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const cards = await accountApi<PaymentCardView[]>('/me/payment-cards', '/account/payments');
  const [t, w] = await Promise.all([getT('account'), getT('wallet')]);
  const notice = param(params, 'notice');
  const error = param(params, 'error');
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 820 }}>
      <AccountHeader title={t('paymentMethods')} description={t('paymentsDescription')} />
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : notice ? (
        <p className="banner banner--ok" role="status">
          {notice}
        </p>
      ) : null}
      <section className="card stack">
        <h2>{w('savedCardsTitle')}</h2>
        {cards.length ? (
          <ul className="saved-cards">
            {cards.map((card) => (
              <li key={card.id}>
                <span className="saved-cards__name">
                  <strong>
                    {w('cardLabel', { brand: cardBrand(card.brand), last4: card.last4 })}
                  </strong>
                  <span className="muted">
                    {w('expires', {
                      month: String(card.expMonth).padStart(2, '0'),
                      year: String(card.expYear),
                    })}
                    {card.expired ? ` · ${w('expiredTag')}` : ''}
                  </span>
                  {card.isDefault ? <span className="pill">{w('defaultTag')}</span> : null}
                </span>
                <span className="saved-cards__actions">
                  {!card.isDefault && !card.expired ? (
                    <form action={makeDefault}>
                      <input type="hidden" name="id" value={card.id} />
                      <button className="btn btn--secondary btn--sm" type="submit">
                        {w('makeDefault')}
                      </button>
                    </form>
                  ) : null}
                  <form action={removeCard}>
                    <input type="hidden" name="id" value={card.id} />
                    <button className="btn btn--link" type="submit">
                      {w('removeCard')}
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0 }}>{w('noCards')}</p>
        )}
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>
          {w('cardsNote')}
        </p>
      </section>
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
