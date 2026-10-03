import { type AccountOrder, type AccountReview, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { Stars } from '@/components/Stars';
import { accountApi } from '@/lib/account';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('accountActivity');
  return { title: t('reviewsTitle'), robots: { index: false } };
}

const STATUS = {
  PENDING: { text: 'reviewStatus_PENDING', pill: 'pill--pending_payment' },
  APPROVED: { text: 'reviewStatus_APPROVED', pill: 'pill--delivered' },
  REJECTED: { text: 'reviewStatus_REJECTED', pill: 'pill--cancelled' },
} as const satisfies Record<AccountReview['status'], { text: string; pill: string }>;

export default async function ReviewsPage() {
  const [reviews, delivered, t, f] = await Promise.all([
    accountApi<AccountReview[]>('/me/reviews', '/account/reviews'),
    accountApi<PagedResult<AccountOrder>>(
      '/me/order-history?filter=delivered&pageSize=50',
      '/account/reviews',
    ),
    getT('accountActivity'),
    getFormat(),
  ]);
  const tc = await getT('common');
  // Products you received and have not reviewed yet, once each.
  const seen = new Set<string>();
  const toReview = delivered.items
    .flatMap((order) => order.lines.filter((l) => l.canReview && l.productSlug))
    .filter((l) => !seen.has(l.productSlug!) && seen.add(l.productSlug!));

  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      <AccountHeader title={t('reviewsTitle')} description={t('reviewsDescription')} />

      {toReview.length ? (
        <section className="stack" style={{ gap: 12 }}>
          <h2>{t('waitingForReview')}</h2>
          <ul className="review-prompts">
            {toReview.map((line) => (
              <li key={line.productSlug} className="card">
                {line.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={line.imageUrl} alt="" width={72} height={72} loading="lazy" />
                ) : null}
                <div className="stack" style={{ gap: 6 }}>
                  <strong>{line.productTitle}</strong>
                  <Link
                    className="btn btn--primary btn--sm"
                    href={`/p/${line.productSlug}#write-review`}
                  >
                    {t('writeReview')}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="stack" style={{ gap: 12 }}>
        <h2>{t('reviewsYouWrote')}</h2>
        {reviews.length === 0 ? (
          <p className="muted">
            {t('noReviews')}
            {toReview.length ? '' : ` ${t('noReviewsHint')}`}
          </p>
        ) : (
          <ul className="review-list">
            {reviews.map((review) => (
              <li key={review.id} className="card">
                {review.product.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={review.product.imageUrl} alt="" width={72} height={72} loading="lazy" />
                ) : null}
                <div className="stack" style={{ gap: 6 }}>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Stars value={review.rating} size={14} />
                    <strong>{review.title}</strong>
                    <span className={`pill ${STATUS[review.status].pill}`}>
                      {t(STATUS[review.status].text)}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>{review.body}</p>
                  <span className="muted" style={{ fontSize: 13 }}>
                    <Link href={`/p/${review.product.slug}`}>{review.product.title}</Link> ·{' '}
                    {f.date(review.createdAt)}
                    {review.verifiedPurchase ? ` · ${t('verifiedPurchase')}` : ''} ·{' '}
                    <Link href={`/p/${review.product.slug}#write-review`}>{tc('edit')}</Link>
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
