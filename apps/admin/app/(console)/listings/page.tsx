import { type ListingReviewRow, type PagedResult, type ProductDetail } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader, Pager } from '@/components/ui';
import { load } from '@/lib/api';
import { param, query, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { reviewListing } from '../sellers/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsCatalog');
  return { title: t('metaListings') };
}

export default async function ListingReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Number(param(params, 'page') ?? 1) || 1;
  const [t, f] = await Promise.all([getT('opsCatalog'), getFormat()]);
  const result = await load<PagedResult<ListingReviewRow>>(
    `/admin/listings/review${query({ page, pageSize: 10 })}`,
  );
  // Full details for each listing in the queue, so staff review the real content.
  const details = await Promise.all(
    result.items.map((row) => load<ProductDetail>(`/admin/products/${row.id}`)),
  );
  const back = `/listings${query({ page })}`;

  return (
    <>
      <PageHeader eyebrow={t('eyebrowMarketplace')} title={t('metaListings')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted">{t('listingsIntro')}</p>
      {result.items.length === 0 ? (
        <section className="card">
          <Empty>{t('nothingToReview')}</Empty>
        </section>
      ) : (
        result.items.map((row, index) => {
          const product = details[index]!;
          const specs = Object.entries(product.attributes);
          return (
            <article key={row.id} className="card">
              <div className="page-header" style={{ marginBottom: 8 }}>
                <div>
                  <h2 style={{ margin: 0 }}>{product.title}</h2>
                  <div className="muted">
                    <Link href={`/sellers/${row.seller.id}`}>{row.seller.displayName}</Link> ·{' '}
                    {product.breadcrumb.map((c) => c.name).join(' › ')} ·{' '}
                    {t('waitingSince', { date: f.dateTime(row.updatedAt) })}
                  </div>
                </div>
                <ActionButton
                  action={reviewListing}
                  label={t('approve')}
                  tone="primary"
                  fields={{ id: row.id, decision: 'APPROVE', back }}
                />
              </div>
              {product.images.length ? (
                <div className="thumbs">
                  {product.images.map((image) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={image.id} src={image.url} alt={image.alt} width={120} height={120} />
                  ))}
                </div>
              ) : null}
              <p style={{ whiteSpace: 'pre-line' }}>{product.description}</p>
              {specs.length ? (
                <p className="muted mono">
                  {specs.map(([key, value]) => `${key}: ${String(value)}`).join(' · ')}
                </p>
              ) : null}
              <p>
                {product.variants
                  .map((v) =>
                    t('variantSummary', {
                      title: v.title,
                      sku: v.sku,
                      price: f.money(v.priceCents, v.currency),
                      count: v.available,
                    }),
                  )
                  .join(' · ')}
              </p>
              <form action={reviewListing} className="form">
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="decision" value="REJECT" />
                <input type="hidden" name="back" value={back} />
                <label>
                  {t('sellerChange')} <span className="hint">{t('shownToSeller')}</span>
                  <textarea name="note" rows={2} required minLength={5} maxLength={1000} />
                </label>
                <div>
                  <SubmitButton tone="danger">{t('sendBack')}</SubmitButton>
                </div>
              </form>
            </article>
          );
        })
      )}
      <Pager
        page={result.page}
        totalPages={result.totalPages}
        href={(n) => `/listings${query({ page: n })}`}
      />
    </>
  );
}
