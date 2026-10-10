import { type MyPlus, type PaymentCardView, type PlusOffer } from '@nixzora/validation';
import { cardBrand } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { isSignedIn } from '@/lib/session';
import { joinPlus } from './actions';
import { type PlanCopy, PlanPicker } from './PlanPicker';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('plus');
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
    alternates: { canonical: '/plus' },
  };
}

const BENEFITS = ['twoDay', 'shipping', 'deals', 'early'] as const;
const ICONS: Record<(typeof BENEFITS)[number], string> = {
  twoDay:
    'M3 7h11v8H3zM14 10h4l3 3v2h-7zM6.5 18.5a1.5 1.5 0 1 0 0-.01M17.5 18.5a1.5 1.5 0 1 0 0-.01',
  shipping: 'M4 7.5 12 3l8 4.5v9L12 21l-8-4.5v-9ZM4 7.5l8 4.5 8-4.5M12 12v9',
  deals: 'M3 12V4h8l10 10-8 8L3 12Zm5-4.5a1 1 0 1 0 0 .01',
  early: 'M12 7v5l3 2M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z',
};

/** NIXZORA Plus (p10-15): what members get, the two plans, and joining. */
export default async function PlusPage({ searchParams }: { searchParams: SearchParams }) {
  const [t, f] = await Promise.all([getT('plus'), getFormat()]);
  const error = param(await searchParams, 'error');
  const signedIn = await isSignedIn();
  const [offer, mine, cards] = await Promise.all([
    api<PlusOffer>('/plus'),
    signedIn ? api<MyPlus>('/me/plus').catch(() => null) : null,
    signedIn ? api<PaymentCardView[]>('/me/payment-cards').catch(() => []) : [],
  ]);
  const usable = cards.filter((c) => !c.expired);
  const trial = (mine?.offer.trialAvailable ?? offer.trialAvailable) !== false;
  const monthly = offer.plans.find((p) => p.plan === 'MONTHLY')!;
  const yearly = offer.plans.find((p) => p.plan === 'YEARLY')!;
  const saves = 1 - yearly.priceCents / (monthly.priceCents * 12);
  const copy = (p: typeof monthly): PlanCopy => {
    const price = f.money(p.priceCents);
    const per = t(`per_${p.plan}`);
    return {
      name: t(`plan_${p.plan}`),
      price: t(p.plan === 'MONTHLY' ? 'perMonth' : 'perYear', { price }),
      ...(p.plan === 'YEARLY'
        ? { save: t('yearlySaves', { percent: f.percent(Math.round(saves * 100) / 100) }) }
        : {}),
      terms: t(trial ? 'trialTerms' : 'paidTerms', { price, per }),
      cta: trial ? t('startTrial') : t('joinFor', { price }),
    };
  };
  const plans = { MONTHLY: copy(monthly), YEARLY: copy(yearly) };

  return (
    <div className="plus-page">
      <section className="plus-hero">
        <div className="wrap stack" style={{ gap: 12 }}>
          <span className="plus-hero__mark" aria-hidden="true">
            NIXZORA <b>Plus</b>
          </span>
          <h1>{t('tagline')}</h1>
          <p>{t('lead')}</p>
        </div>
      </section>

      <div className="wrap section stack" style={{ gap: 28 }}>
        <ul className="plus-benefits">
          {BENEFITS.map((key) => (
            <li key={key} className="card">
              <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true">
                <path
                  d={ICONS[key]}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <strong>{t(`benefit_${key}_title`)}</strong>
              <span className="muted">{t(`benefit_${key}_body`)}</span>
            </li>
          ))}
        </ul>

        {error ? (
          <p className="banner banner--error" role="alert">
            {error}
          </p>
        ) : null}

        {mine?.membership ? (
          <div className="card stack" style={{ gap: 10 }}>
            <strong>{t('alreadyMember')}</strong>
            <Link
              className="btn btn--primary"
              href="/account/plus"
              style={{ justifySelf: 'start' }}
            >
              {t('manage')}
            </Link>
          </div>
        ) : (
          <form action={joinPlus} className="stack plus-join" style={{ gap: 18 }}>
            <PlanPicker legend={t('plan')} plans={plans} canJoin={signedIn}>
              {!signedIn ? null : usable.length ? (
                <label className="stack" style={{ gap: 6, maxWidth: 420 }}>
                  <span>{trial ? t('renewalCard') : t('payWithCard')}</span>
                  <select name="paymentCardId" defaultValue={usable.find((c) => c.isDefault)?.id}>
                    {usable.map((c) => (
                      <option key={c.id} value={c.id}>
                        {cardBrand(c.brand)} •••• {c.last4}
                      </option>
                    ))}
                    {trial ? null : <option value="new">{t('newCard')}</option>}
                  </select>
                </label>
              ) : (
                <p className="hint">{trial ? t('noCardTrial') : t('newCardNote')}</p>
              )}
            </PlanPicker>
            {signedIn ? null : (
              <Link className="btn btn--primary plus-cta" href="/account/login?next=%2Fplus">
                {t('signInToJoin')}
              </Link>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
