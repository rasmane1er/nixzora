import { type AdminSellerView, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader, Pager, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { param, query, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsOrders');
  return { title: t('metaSellers') };
}

const STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED'] as const;

export default async function SellersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const status = param(params, 'status');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const [t, f] = await Promise.all([getT('opsOrders'), getFormat()]);
  const result = await load<PagedResult<AdminSellerView>>(
    `/admin/sellers${query({ q, status, page })}`,
  );

  return (
    <>
      <PageHeader eyebrow={t('eyebrowMarketplace')} title={t('metaSellers')} />
      <form className="toolbar" role="search">
        <label>
          {t('search')}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t('searchSellersPlaceholder')}
          />
        </label>
        <label>
          {t('status')}
          <select name="status" defaultValue={status ?? ''}>
            <option value="">{t('any')}</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`sellerStatus_${s}`)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--secondary" type="submit">
          {t('filter')}
        </button>
      </form>

      <section className="card">
        {result.items.length === 0 ? (
          <Empty>{status === 'PENDING' ? t('noApplications') : t('noSellers')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colStore')}</th>
                  <th>{t('status')}</th>
                  <th>{t('colPayouts')}</th>
                  <th className="num">{t('colLive')}</th>
                  <th className="num">{t('colInReview')}</th>
                  <th>{t('colApplied')}</th>
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
                        ? t('payoutsVerified')
                        : seller.payouts.detailsSubmitted
                          ? t('payoutsSubmitted')
                          : seller.payouts.accountConnected
                            ? t('payoutsStarted')
                            : t('payoutsNotStarted')}
                    </td>
                    <td className="num">{seller.listings.active}</td>
                    <td className="num">{seller.listings.pendingReview}</td>
                    <td>{f.dateTime(seller.createdAt)}</td>
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
