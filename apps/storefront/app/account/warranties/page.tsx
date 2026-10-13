import { warrantyLabel } from '@nixzora/i18n';
import { type WarrantyView } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('warranty');
  return { title: t('title'), robots: { index: false } };
}

const STATUS_KEY = {
  ACTIVE: 'statusActive',
  ENDING_SOON: 'statusEndingSoon',
  ENDED: 'statusEnded',
} as const;

/** Warranty tracker (p10-33): what's still covered, until when, and who to contact. */
export default async function WarrantiesPage() {
  const [items, t, f] = await Promise.all([
    accountApi<WarrantyView[]>('/me/warranties', '/account/warranties'),
    getT('warranty'),
    getFormat(),
  ]);
  const day = (iso: string) => f.date(`${iso}T12:00:00Z`);
  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title={t('title')} description={t('lead')} />
      {items.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>{t('empty')}</p>
        </div>
      ) : (
        <ul className="warranty-list">
          {items.map((item) => (
            <li key={item.orderItemId} className="card warranty-item">
              <div className="warranty-item__img">
                {item.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- product photo from our media host
                  <img src={item.imageUrl} alt="" loading="lazy" />
                ) : null}
              </div>
              <div className="stack" style={{ gap: 4, minWidth: 0 }}>
                <span className={`pill pill--warranty-${item.status.toLowerCase()}`}>
                  {t(STATUS_KEY[item.status])}
                </span>
                {item.productSlug ? (
                  <Link href={`/p/${item.productSlug}`} className="warranty-item__title">
                    {item.productTitle}
                  </Link>
                ) : (
                  <span className="warranty-item__title">{item.productTitle}</span>
                )}
                <span className="muted">
                  {warrantyLabel(t, item.months)} · {item.variantTitle}
                </span>
                <strong>
                  {item.status === 'ENDED'
                    ? t('endedOn', { date: day(item.until) })
                    : t('coveredUntil', { date: day(item.until) })}
                </strong>
                <span className="muted">
                  {t('since', {
                    date: day(item.from),
                    number: item.orderNumber.replace('-', '\u2011'),
                  })}
                  {item.seller ? ` · ${t('soldBy', { store: item.seller.displayName })}` : ''}
                </span>
                <span className="warranty-item__actions">
                  {item.status !== 'ENDED' ? (
                    <Link
                      className="btn btn--secondary btn--sm"
                      href={
                        item.seller
                          ? `/account/messages/new?store=${item.seller.handle}&order=${item.orderNumber}`
                          : `/help/chat?order=${item.orderNumber}`
                      }
                    >
                      {item.seller ? t('contact') : t('contactNixzora')}
                    </Link>
                  ) : null}
                  <Link href={`/orders/${item.orderNumber}`}>{t('viewOrder')}</Link>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
