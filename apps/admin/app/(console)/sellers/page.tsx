import { type AdminSellerView, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader, Pager, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, param, query, type SearchParams } from '@/lib/format';

export const metadata: Metadata = { title: 'Sellers' };

const STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;

export default async function SellersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const status = param(params, 'status');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const result = await load<PagedResult<AdminSellerView>>(
    `/admin/sellers${query({ q, status, page })}`,
  );

  return (
    <>
      <PageHeader eyebrow="Marketplace" title="Sellers" />
      <form className="toolbar" role="search">
        <label>
          Search
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Store, legal name, address or email"
          />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status ?? ''}>
            <option value="">Any</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.toLowerCase()}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--secondary" type="submit">
          Filter
        </button>
      </form>

      <section className="card">
        {result.items.length === 0 ? (
          <Empty>{status === 'PENDING' ? 'No applications waiting.' : 'No sellers match.'}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Store</th>
                  <th>Status</th>
                  <th>Payouts</th>
                  <th className="num">Live</th>
                  <th className="num">In review</th>
                  <th>Applied</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((seller) => (
                  <tr key={seller.id}>
                    <td>
                      <Link href={`/sellers/${seller.id}`}>{seller.displayName}</Link>
                      <div className="muted">
                        {seller.legalName} · /s/{seller.handle}
                      </div>
                    </td>
                    <td>
                      <StatusPill value={seller.status} />
                    </td>
                    <td>
                      {seller.payouts.payoutsEnabled
                        ? 'Verified'
                        : seller.payouts.detailsSubmitted
                          ? 'Submitted'
                          : seller.payouts.accountConnected
                            ? 'Started'
                            : 'Not started'}
                    </td>
                    <td className="num">{seller.listings.active}</td>
                    <td className="num">{seller.listings.pendingReview}</td>
                    <td>{dateTime(seller.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <Pager
        page={result.page}
        totalPages={result.totalPages}
        href={(n) => `/sellers${query({ q, status, page: n })}`}
      />
    </>
  );
}
