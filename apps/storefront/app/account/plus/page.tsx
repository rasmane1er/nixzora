import { cardBrand } from '@nixzora/i18n';
import { type MyPlus, type PaymentCardView, type PlusPlan } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { updatePlus } from '@/app/plus/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('plus');
  return { title: t('accountMeta'), robots: { index: false } };
}

/** The member's NIXZORA Plus page (p10-15): status, renewals, card, plan, leaving. */
export default async function AccountPlusPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [mine, cards, t, c, f] = await Promise.all([
    accountApi<MyPlus>('/me/plus', '/account/plus'),
    accountApi<PaymentCardView[]>('/me/payment-cards', '/account/plus'),
    getT('plus'),
    getT('common'),
    getFormat(),
  ]);
  const notice = param(params, 'notice');
  const error = param(params, 'error');
  const m = mine.membership;
  const other: PlusPlan | null = m ? (m.plan === 'MONTHLY' ? 'YEARLY' : 'MONTHLY') : null;
  const usable = cards.filter((c) => !c.expired);

  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 820 }}>
      <AccountHeader title={t('title')} description={t('accountLead')} />
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : notice ? (
        <p className="banner banner--ok" role="status">
          {notice}
        </p>
      ) : null}

      {!m ? (
        <div className="card stack" style={{ gap: 12 }}>
          <p style={{ margin: 0 }}>{t('notMember')}</p>
          <Link className="btn btn--primary" href="/plus" style={{ justifySelf: 'start' }}>
            {mine.offer.trialAvailable ? t('tryFree') : t('join')}
          </Link>
        </div>
      ) : (
        <>
          <section className="card plus-status stack" style={{ gap: 8 }}>
            <div className="plus-status__head">
              <span className="plus-chip">{t('badge')}</span>
              <strong>{t(`status_${m.status}`)}</strong>
              <span className="muted">· {t(`plan_${m.plan}`)}</span>
            </div>
            <span>
              {m.trial
                ? t('trialUntil', { date: f.date(m.currentPeriodEnd) })
                : t('activeUntil', { date: f.date(m.currentPeriodEnd) })}
            </span>
            {m.cancelAtPeriodEnd ? (
              <span>{t('leavingNote', { date: f.date(m.currentPeriodEnd) })}</span>
            ) : m.nextCharge ? (
              <span>
                {t('nextCharge', {
                  amount: f.money(m.nextCharge.amountCents),
                  date: f.date(m.nextCharge.at),
                })}
              </span>
            ) : null}
            <span className="muted">{t('memberSince', { date: f.date(m.memberSince) })}</span>
            {m.savedCents ? (
              <strong className="plus-saved">
                {t('saved', { amount: f.money(m.savedCents) })}
              </strong>
            ) : null}
          </section>

          {m.unpaidOrderNumber ? (
            <p className="banner banner--error" role="alert">
              {t('pastDue')}{' '}
              <Link href={`/checkout/pay/${m.unpaidOrderNumber}`}>{t('payNow')}</Link>
            </p>
          ) : null}

          {m.cancelAtPeriodEnd ? (
            <form action={updatePlus}>
              <input type="hidden" name="cancelAtPeriodEnd" value="false" />
              <button className="btn btn--primary" type="submit">
                {t('keep')}
              </button>
            </form>
          ) : (
            <>
              <section className="card stack" style={{ gap: 10 }}>
                <h2 style={{ margin: 0 }}>{t('changeCard')}</h2>
                {usable.length ? (
                  <form action={updatePlus} className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    <select
                      name="paymentCardId"
                      defaultValue={m.card?.id ?? 'default'}
                      aria-label={t('changeCard')}
                    >
                      {usable.map((card) => (
                        <option key={card.id} value={card.id}>
                          {cardBrand(card.brand)} •••• {card.last4}
                        </option>
                      ))}
                    </select>
                    <button className="btn btn--secondary btn--sm" type="submit">
                      {c('save')}
                    </button>
                  </form>
                ) : (
                  <p className="hint" style={{ margin: 0 }}>
                    {t('noCard')}
                  </p>
                )}
              </section>

              <section className="card stack" style={{ gap: 10 }}>
                <h2 style={{ margin: 0 }}>{t('plan')}</h2>
                <form action={updatePlus} className="row" style={{ gap: 12, flexWrap: 'wrap' }}>
                  <input type="hidden" name="plan" value={other!} />
                  <button className="btn btn--secondary btn--sm" type="submit">
                    {t('switchPlan', { plan: t(`plan_${other!}`).toLowerCase() })}
                  </button>
                  <span className="hint">{t('planChanges')}</span>
                </form>
              </section>

              <details className="card cancel-order">
                <summary>
                  <span className="btn btn--link">{t('cancel')}</span>
                </summary>
                <form action={updatePlus} className="cancel-order__confirm">
                  <input type="hidden" name="cancelAtPeriodEnd" value="true" />
                  <p style={{ margin: 0 }}>
                    {t('cancelConfirm', { date: f.date(m.currentPeriodEnd) })}
                  </p>
                  <button className="btn btn--danger btn--sm" type="submit">
                    {t('cancelYes')}
                  </button>
                </form>
              </details>
            </>
          )}
        </>
      )}
    </div>
  );
}
