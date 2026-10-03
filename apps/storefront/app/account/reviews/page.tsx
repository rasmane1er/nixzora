import { type AccountOrder, type AccountReview, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader } from '@/components/AccountHeader';
import { Stars } from '@/components/Stars';
import { accountApi, day } from '@/lib/account';

export const metadata: Metadata = { title: 'Your reviews', robots: { index: false } };

const STATUS: Record<AccountReview['status'], { text: string; pill: string }> = {
  PENDING: { text: 'Being checked', pill: 'pill--pending_payment' },
  APPROVED: { text: 'Published', pill: 'pill--delivered' },
  REJECTED: { text: 'Not published', pill: 'pill--cancelled' },
};

export default async function ReviewsPage() {
  const [reviews, delivered] = await Promise.all([
    accountApi<AccountReview[]>('/me/reviews', '/account/reviews'),
    accountApi<PagedResult<AccountOrder>>(
      '/me/order-history?filter=delivered&pageSize=50',
      '/account/reviews',
    ),
  ]);
  // Products you received and have not reviewed yet, once each.
  const seen = new Set<string>();
  const toReview = delivered.items
    .flatMap((order) => order.lines.filter((l) => l.canReview && l.productSlug))
    .filter((l) => !seen.has(l.productSlug!) && seen.add(l.productSlug!));

  return (
    <div className="wrap section stack" style={{ gap: 24 }}>
      <AccountHeader
        title="Your reviews"
        description="Reviews help other shoppers. We check each one before it is published."
      />

      {toReview.length ? (
        <section className="stack" style={{ gap: 12 }}>
          <h2>Waiting for your review</h2>
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
                    Write a review
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="stack" style={{ gap: 12 }}>
        <h2>Reviews you wrote</h2>
        {reviews.length === 0 ? (
          <p className="muted">
            You have not written any reviews yet.
            {toReview.length ? '' : ' Products you receive will show up here to review.'}
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
                      {STATUS[review.status].text}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>{review.body}</p>
                  <span className="muted" style={{ fontSize: 13 }}>
                    <Link href={`/p/${review.product.slug}`}>{review.product.title}</Link> ·{' '}
                    {day(review.createdAt)}
                    {review.verifiedPurchase ? ' · Verified purchase' : ''} ·{' '}
                    <Link href={`/p/${review.product.slug}#write-review`}>Edit</Link>
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
