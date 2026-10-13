import { calendarDay } from '@nixzora/i18n';
import { type BuyReminderView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { cancelBuyReminder } from '../hub-actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('buyReminders');
  return { title: t('title'), robots: { index: false } };
}

/** "Remind me to buy" (p10-36): the reminders a customer has set, soonest first. */
export default async function BuyRemindersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [items, t, f, locale] = await Promise.all([
    accountApi<BuyReminderView[]>('/me/buy-reminders', '/account/buy-reminders'),
    getT('buyReminders'),
    getFormat(),
    getLocale(),
  ]);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title={t('title')} description={t('lead')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      {items.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>{t('empty')}</p>
        </div>
      ) : (
        <ul className="warranty-list">
          {items.map((item) => (
            <li key={item.productId} className="card warranty-item">
              <div className="warranty-item__img">
                {item.product?.image ? (
                  // eslint-disable-next-line @next/next/no-img-element -- product photo from our media host
                  <img src={item.product.image.url} alt="" loading="lazy" />
                ) : null}
              </div>
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <strong>{t('remindOn', { date: calendarDay(item.date, locale) })}</strong>
                {item.product ? (
                  <Link href={`/p/${item.product.slug}`} className="warranty-item__title">
                    {item.product.title}
                  </Link>
                ) : null}
                {item.product ? (
                  <span>
                    <strong>{f.money(item.product.priceFromCents)}</strong>
                    {item.product.priceFromCents !== item.priceCents ? (
                      <span className="muted">
                        {' · '}
                        {t('priceWhenSet', { price: f.money(item.priceCents) })}
                      </span>
                    ) : null}
                  </span>
                ) : null}
                <form action={cancelBuyReminder} className="warranty-item__actions">
                  <input type="hidden" name="productId" value={item.productId} />
                  <button type="submit" className="btn btn--secondary btn--sm">
                    {t('cancel')}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
