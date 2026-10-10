import { cardBrand } from '@nixzora/i18n';
import {
  SUBSCRIBE_PERCENT,
  SUBSCRIPTION_INTERVALS,
  SUBSCRIPTION_MAX_QUANTITY,
  type SubscriptionView,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { cancelSubscription, updateSubscription } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('subscribe');
  return { title: t('metaTitle'), robots: { index: false } };
}

/** Subscribe & Save (p10-11): what is coming, and how to change it. */
export default async function SubscriptionsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [subs, t, w, f] = await Promise.all([
    accountApi<SubscriptionView[]>('/me/subscriptions', '/account/subscriptions'),
    getT('subscribe'),
    getT('wallet'),
    getFormat(),
  ]);
  const notice = param(params, 'notice');
  const error = param(params, 'error');
  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 900 }}>
      <AccountHeader
        title={t('title')}
        description={t('lead', { percent: f.percent(SUBSCRIBE_PERCENT / 100) })}
      />
      {error ? (
        <p className="banner banner--error" role="alert">
          {error}
        </p>
      ) : notice ? (
        <p className="banner banner--ok" role="status">
          {notice}
        </p>
      ) : null}
      {subs.length ? (
        <ul className="subs">
          {subs.map((sub) => (
            <li key={sub.id} className="card subs__item">
              <div className="subs__head">
                {sub.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- small thumbnail
                  <img src={sub.product.imageUrl} alt="" width={72} height={72} />
                ) : null}
                <div className="stack" style={{ gap: 4 }}>
                  <Link href={`/p/${sub.product.slug}`}>
                    <strong>{sub.product.title}</strong>
                  </Link>
                  <span className="muted">
                    {sub.variantTitle} · {f.money(sub.unitPriceCents)}
                  </span>
                  <span>
                    {sub.status === 'PAUSED' ? (
                      <span className="pill">{t('paused')}</span>
                    ) : sub.nextOrderAt ? (
                      t('next', { date: f.date(sub.nextOrderAt) })
                    ) : null}
                  </span>
                  <span className="muted" style={{ fontSize: 13 }}>
                    {sub.card
                      ? t('chargedTo', {
                          card: w('cardLabel', {
                            brand: cardBrand(sub.card.brand),
                            last4: sub.card.last4,
                          }),
                          address: sub.shipTo,
                        })
                      : t('noCard')}
                    {sub.lastOrderNumber
                      ? ` · ${t('lastOrder', { number: sub.lastOrderNumber })}`
                      : ''}
                  </span>
                  {sub.failures ? (
                    <span className="banner banner--error" style={{ fontSize: 13 }}>
                      {t('failed')}
                    </span>
                  ) : null}
                </div>
              </div>
              <form action={updateSubscription} className="subs__form">
                <input type="hidden" name="id" value={sub.id} />
                <label>
                  {t('quantity')}
                  <select name="quantity" defaultValue={sub.quantity}>
                    {Array.from({ length: SUBSCRIPTION_MAX_QUANTITY }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('every')}
                  <select name="intervalDays" defaultValue={sub.intervalDays}>
                    {SUBSCRIPTION_INTERVALS.map((days) => (
                      <option key={days} value={days}>
                        {t(`interval_${days}`)}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="subs__actions">
                  <button className="btn btn--secondary btn--sm" name="action" value="save">
                    {t('save')}
                  </button>
                  {sub.status === 'ACTIVE' ? (
                    <>
                      <button className="btn btn--secondary btn--sm" name="action" value="skip">
                        {t('skip')}
                      </button>
                      <button className="btn btn--secondary btn--sm" name="action" value="pause">
                        {t('pause')}
                      </button>
                    </>
                  ) : (
                    <button className="btn btn--primary btn--sm" name="action" value="resume">
                      {t('resume')}
                    </button>
                  )}
                </div>
              </form>
              <form action={cancelSubscription}>
                <input type="hidden" name="id" value={sub.id} />
                <button className="btn btn--link" type="submit">
                  {t('cancel')}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty card">
          <p>{t('none')}</p>
        </div>
      )}
    </div>
  );
}
