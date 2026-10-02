import { type AdminReviewView, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionButton, Banner, Empty, PageHeader, Pager } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, param, query, type SearchParams } from '@/lib/format';
import { moderate } from './actions';

export const metadata: Metadata = { title: 'Reviews' };

const STOREFRONT = process.env.STOREFRONT_URL ?? 'http://localhost:3000';

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = (param(params, 'status') ?? 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED';
  const page = Number(param(params, 'page') ?? 1) || 1;
  const result = await load<PagedResult<AdminReviewView>>(
    `/admin/reviews${query({ status, page })}`,
  );
  const back = `/reviews${query({ status, page })}`;

  return (
    <>
      <PageHeader eyebrow="Catalog" title="Reviews" />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <nav className="toolbar" aria-label="Review status">
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <Link
            key={s}
            href={`/reviews?status=${s}`}
            className={`btn ${s === status ? 'btn--primary' : 'btn--secondary'}`}
          >
            {s === 'PENDING' ? 'To moderate' : s.toLowerCase()}
          </Link>
        ))}
      </nav>
      {result.items.length === 0 ? (
        <section className="card">
          <Empty>{status === 'PENDING' ? 'Nothing waiting. Nice.' : 'No reviews here.'}</Empty>
        </section>
      ) : (
        result.items.map((review) => (
          <article key={review.id} className="card">
            <div className="page-header" style={{ marginBottom: 6 }}>
              <div>
                <strong>
                  {'★'.repeat(review.rating)}
                  {'☆'.repeat(5 - review.rating)}
                </strong>{' '}
                {review.title}
                <div className="muted">
                  <a
                    href={`${STOREFRONT}/p/${review.product.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {review.product.title}
                  </a>{' '}
                  · {review.author} ({review.authorEmail}) · {dateTime(review.createdAt)}
                  {review.verifiedPurchase ? ' · verified purchase' : ''}
                </div>
              </div>
              <div className="inline-form">
                {review.status !== 'APPROVED' ? (
                  <ActionButton
                    action={moderate}
                    label="Publish"
                    tone="primary"
                    fields={{ id: review.id, status: 'APPROVED', back }}
                  />
                ) : null}
                {review.status !== 'REJECTED' ? (
                  <ActionButton
                    action={moderate}
                    label="Reject"
                    tone="danger"
                    fields={{ id: review.id, status: 'REJECTED', back }}
                  />
                ) : null}
              </div>
            </div>
            <p style={{ whiteSpace: 'pre-line' }}>{review.body}</p>
          </article>
        ))
      )}
      <Pager
        page={result.page}
        totalPages={result.totalPages}
        href={(n) => `/reviews${query({ status, page: n })}`}
      />
    </>
  );
}
