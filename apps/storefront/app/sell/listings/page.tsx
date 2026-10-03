import { type PagedResult, type SellerProductRow } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { param, query, type SearchParams } from '@/lib/params';
import { LISTING_STATUS_LABEL, requireSeller } from '@/lib/sell';

export const metadata: Metadata = { title: 'Your listings', robots: { index: false } };

const FILTERS = [
  [undefined, 'All'],
  ['DRAFT', 'Drafts'],
  ['PENDING_REVIEW', 'In review'],
  ['ACTIVE', 'Live'],
] as const;

export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = param(params, 'status');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const seller = await requireSeller('/sell/listings');
  const result = await api<PagedResult<SellerProductRow>>(
    `/seller/products${query({ status, page })}`,
  );

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/listings" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="section-head" style={{ marginBottom: 0 }}>
        <nav className="seller-filters" aria-label="Filter listings">
          {FILTERS.map(([value, label]) => (
            <Link
              key={label}
              href={`/sell/listings${query({ status: value })}`}
              aria-current={status === value ? 'page' : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn--secondary" href="/sell/listings/import">
            Import from CSV
          </Link>
          <Link className="btn btn--primary" href="/sell/listings/new">
            Add a listing
          </Link>
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="empty card">
          <p>
            {status ? 'No listings here.' : 'No listings yet.'}{' '}
            <Link href="/sell/listings/new">Add your first product →</Link>
          </p>
        </div>
      ) : (
        <section className="card">
          <table className="plain">
            <thead>
              <tr>
                <th>Product</th>
                <th>Status</th>
                <th className="num">Price</th>
                <th className="num">Stock</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((row) => (
                <tr key={row.id}>
                  <td>
                    <div className="listing-cell">
                      {row.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.image.url} alt="" width={44} height={44} />
                      ) : (
                        <span className="listing-cell__blank" aria-hidden="true" />
                      )}
                      <div>
                        <Link href={`/sell/listings/${row.id}`}>{row.title}</Link>
                        <div className="muted" style={{ fontSize: 13 }}>
                          {row.category.name}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`pill pill--listing-${row.status.toLowerCase()}`}>
                      {LISTING_STATUS_LABEL[row.status]}
                    </span>
                    {row.reviewNote ? (
                      <div className="muted" style={{ fontSize: 13 }}>
                        Changes requested
                      </div>
                    ) : null}
                  </td>
                  <td className="num">{formatMoney(row.priceFromCents, row.currency)}</td>
                  <td className="num">{row.inStock ? 'In stock' : 'Out of stock'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
      {result.totalPages > 1 ? (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? (
            <Link href={`/sell/listings${query({ status, page: page - 1 })}`}>← Newer</Link>
          ) : null}
          <span className="muted">
            Page {result.page} of {result.totalPages}
          </span>
          {page < result.totalPages ? (
            <Link href={`/sell/listings${query({ status, page: page + 1 })}`}>Older →</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
