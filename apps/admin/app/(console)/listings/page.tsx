import { type ListingReviewRow, type PagedResult, type ProductDetail } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader, Pager } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, money, param, query, type SearchParams } from '@/lib/format';
import { reviewListing } from '../sellers/actions';

export const metadata: Metadata = { title: 'Listing review' };

export default async function ListingReviewPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Number(param(params, 'page') ?? 1) || 1;
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
      <PageHeader eyebrow="Marketplace" title="Listing review" />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted">
        Seller listings wait here before going live, and come back after content changes. Check that
        photos match the product, specs are plausible, and nothing is counterfeit or banned.
      </p>
      {result.items.length === 0 ? (
        <section className="card">
          <Empty>Nothing waiting for review.</Empty>
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
                    {product.breadcrumb.map((c) => c.name).join(' › ')} · waiting since{' '}
                    {dateTime(row.updatedAt)}
                  </div>
                </div>
                <ActionButton
                  action={reviewListing}
                  label="Approve"
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
                  .map(
                    (v) =>
                      `${v.title} (${v.sku}) ${money(v.priceCents, v.currency)}, ${v.available} available`,
                  )
                  .join(' · ')}
              </p>
              <form action={reviewListing} className="form">
                <input type="hidden" name="id" value={row.id} />
                <input type="hidden" name="decision" value="REJECT" />
                <input type="hidden" name="back" value={back} />
                <label>
                  What should the seller change? <span className="hint">Shown to the seller.</span>
                  <textarea name="note" rows={2} required minLength={5} maxLength={1000} />
                </label>
                <div>
                  <SubmitButton tone="danger">Send back</SubmitButton>
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
