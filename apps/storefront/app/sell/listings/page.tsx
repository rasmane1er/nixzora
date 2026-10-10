import { type PagedResult, type SellerProductRow } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { departmentName, getFormat, getT } from '@/lib/i18n';
import { param, query, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { setSubscribable } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellerTools');
  return { title: t('metaListings'), robots: { index: false } };
}

const FILTERS = [
  [undefined, 'filterAll'],
  ['DRAFT', 'filterDrafts'],
  ['PENDING_REVIEW', 'filterInReview'],
  ['ACTIVE', 'filterLive'],
] as const;

export default async function ListingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = param(params, 'status');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const seller = await requireSeller('/sell/listings');
  const result = await api<PagedResult<SellerProductRow>>(
    `/seller/products${query({ status, page })}`,
  );
  const sb = await getT('subscribe');
  const [t, f, categoryNames] = await Promise.all([
    getT('sellerTools'),
    getFormat(),
    Promise.all(result.items.map((row) => departmentName(row.category))),
  ]);

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/listings" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="section-head" style={{ marginBottom: 0 }}>
        <nav className="seller-filters" aria-label={t('filterListingsLabel')}>
          {FILTERS.map(([value, label]) => (
            <Link
              key={label}
              href={`/sell/listings${query({ status: value })}`}
              aria-current={status === value ? 'page' : undefined}
            >
              {t(label)}
            </Link>
          ))}
        </nav>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn--secondary" href="/sell/listings/import">
            {t('importCsv')}
          </Link>
          <Link className="btn btn--primary" href="/sell/listings/new">
            {t('addListing')}
          </Link>
        </div>
      </div>

      {result.items.length === 0 ? (
        <div className="empty card">
          <p>
            {status ? t('noListingsHere') : t('noListingsYet')}{' '}
            <Link href="/sell/listings/new">{t('addFirstProduct')}</Link>
          </p>
        </div>
      ) : (
        <section className="card">
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr>
                  <th>{t('colProduct')}</th>
                  <th>{t('colStatus')}</th>
                  <th className="num">{t('colPrice')}</th>
                  <th className="num">{t('colStock')}</th>
                  <th>
                    <span title={sb('sellerToggleHint')}>{sb('sellerToggle')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((row, i) => (
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
                            {categoryNames[i]}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`pill pill--listing-${row.status.toLowerCase()}`}>
                        {t(`listing_${row.status}`)}
                      </span>
                      {row.reviewNote ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          {t('changesRequested')}
                        </div>
                      ) : null}
                    </td>
                    <td className="num">{f.money(row.priceFromCents, row.currency)}</td>
                    <td className="num">{row.inStock ? t('inStock') : t('outOfStock')}</td>
                    <td>
                      <form action={setSubscribable} className="inline-toggle">
                        <input type="hidden" name="productId" value={row.id} />
                        <input
                          type="hidden"
                          name="allowed"
                          value={row.subscribable ? 'false' : 'true'}
                        />
                        <span className="muted" style={{ fontSize: 13 }}>
                          {row.subscribable ? sb('sellerOn') : sb('sellerOff')}
                        </span>{' '}
                        <button className="btn btn--link" type="submit">
                          {row.subscribable ? sb('sellerTurnOff') : sb('sellerTurnOn')}
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {result.totalPages > 1 ? (
        <nav className="pager" aria-label={t('pagesLabel')}>
          {page > 1 ? (
            <Link href={`/sell/listings${query({ status, page: page - 1 })}`}>{t('newer')}</Link>
          ) : null}
          <span className="muted">
            {t('pageOf', { page: result.page, total: result.totalPages })}
          </span>
          {page < result.totalPages ? (
            <Link href={`/sell/listings${query({ status, page: page + 1 })}`}>{t('older')}</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
