import { type AdminReviewView, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionButton, Banner, Empty, PageHeader, Pager } from '@/components/ui';
import { load } from '@/lib/api';
import { param, query, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { moderate } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsCatalog');
  return { title: t('metaReviews') };
}

const STOREFRONT = process.env.STOREFRONT_URL ?? 'http://localhost:3000';

export default async function ReviewsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = (param(params, 'status') ?? 'PENDING') as 'PENDING' | 'APPROVED' | 'REJECTED';
  const page = Number(param(params, 'page') ?? 1) || 1;
  const [t, f] = await Promise.all([getT('opsCatalog'), getFormat()]);
  const result = await load<PagedResult<AdminReviewView>>(
    `/admin/reviews${query({ status, page })}`,
  );
  const back = `/reviews${query({ status, page })}`;

  return (
    <>
      <PageHeader eyebrow={t('eyebrowCatalog')} title={t('metaReviews')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <nav className="toolbar" aria-label={t('reviewStatus')}>
        {(['PENDING', 'APPROVED', 'REJECTED'] as const).map((s) => (
          <Link
            key={s}
            href={`/reviews?status=${s}`}
            className={`btn ${s === status ? 'btn--primary' : 'btn--secondary'}`}
          >
            {t(`review_${s}`)}
          </Link>
        ))}
      </nav>
      {result.items.length === 0 ? (
        <section className="card">
          <Empty>{status === 'PENDING' ? t('nothingWaiting') : t('noReviews')}</Empty>
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
                  · {review.author} ({review.authorEmail}) · {f.dateTime(review.createdAt)}
                  {review.verifiedPurchase ? ` · ${t('verifiedPurchase')}` : ''}
                </div>
              </div>
              <div className="inline-form">
                {review.status !== 'APPROVED' ? (
                  <ActionButton
                    action={moderate}
                    label={t('publish')}
                    tone="primary"
                    fields={{ id: review.id, status: 'APPROVED', back }}
                  />
                ) : null}
                {review.status !== 'REJECTED' ? (
                  <ActionButton
                    action={moderate}
                    label={t('reject')}
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
