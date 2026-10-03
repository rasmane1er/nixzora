import {
  type PagedResult,
  type PayoutView,
  type SellerBalance,
  type SellerLedgerEntryView,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SellerBalanceCards } from '@/components/SellerBalanceCards';
import { SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';

/** Outside render: the current time is read when the page is built. */
function isFuture(iso: string): boolean {
  return Date.parse(iso) > Date.now();
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellerTools');
  return { title: t('metaEarnings'), robots: { index: false } };
}

export default async function EarningsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Number(param(params, 'page') ?? 1) || 1;
  const seller = await requireSeller('/sell/earnings');
  const [balance, ledger, payouts] = await Promise.all([
    api<SellerBalance>('/seller/balance'),
    api<PagedResult<SellerLedgerEntryView>>(`/seller/ledger?page=${page}`),
    api<PagedResult<PayoutView>>('/seller/payouts'),
  ]);
  const [t, f] = await Promise.all([getT('sellerTools'), getFormat()]);
  const money = (cents: number) => f.money(cents, balance.currency);
  const day = (iso: string) => f.date(iso);
  const payoutLabel = (status: PayoutView['status']) => t(`payout_${status}`);
  const typeLabel = (type: SellerLedgerEntryView['type']) => t(`ledger_${type}`);

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/earnings" />
      <SellerBalanceCards balance={balance} />
      <p className="muted" style={{ fontSize: 14 }}>
        {balance.nextReleaseAt
          ? t('earningsHoldNext', {
              days: seller.payoutHoldDays,
              date: day(balance.nextReleaseAt),
            })
          : t('earningsHold', { days: seller.payoutHoldDays })}{' '}
        {t('earningsRefunds')}
        {seller.payouts.provider === 'FAKE' ? ` ${t('testMode')}` : ''}
      </p>

      <section className="card">
        <h2>{t('payoutsTitle')}</h2>
        <p className="muted" style={{ fontSize: 14 }}>
          {t(seller.payouts.payoutsEnabled ? 'payoutsAuto' : 'payoutsAutoPending', {
            min: money(1000),
          })}
        </p>
        {payouts.items.length === 0 ? (
          <p className="muted">{t('noPayouts')}</p>
        ) : (
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr>
                  <th>{t('colDate')}</th>
                  <th>{t('colStatus')}</th>
                  <th className="num">{t('colAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {payouts.items.map((payout) => (
                  <tr key={payout.id}>
                    <td>{day(payout.paidAt ?? payout.createdAt)}</td>
                    <td>
                      {payoutLabel(payout.status)}
                      {payout.status === 'FAILED' ? (
                        <div className="muted" style={{ fontSize: 13 }}>
                          {t('payoutFailedHint')}
                        </div>
                      ) : null}
                    </td>
                    <td className="num">{money(payout.amountCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>{t('activityTitle')}</h2>
        {ledger.items.length === 0 ? (
          <p className="muted">{t('noActivity')}</p>
        ) : (
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr>
                  <th>{t('colDate')}</th>
                  <th>{t('colActivity')}</th>
                  <th>{t('colAvailable')}</th>
                  <th className="num">{t('colAmount')}</th>
                </tr>
              </thead>
              <tbody>
                {ledger.items.map((entry) => (
                  <tr key={entry.id}>
                    <td>{day(entry.createdAt)}</td>
                    <td>
                      <strong>{typeLabel(entry.type)}</strong>{' '}
                      <span className="muted">{entry.description}</span>
                    </td>
                    <td>
                      {isFuture(entry.availableAt) ? day(entry.availableAt) : t('availableNow')}
                    </td>
                    <td className={`num ${entry.amountCents < 0 ? 'neg' : ''}`}>
                      {entry.amountCents > 0 ? '+' : ''}
                      {money(entry.amountCents)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {ledger.totalPages > 1 ? (
        <nav className="pager" aria-label={t('pagesLabel')}>
          {page > 1 ? <Link href={`/sell/earnings?page=${page - 1}`}>{t('newer')}</Link> : null}
          <span className="muted">
            {t('pageOf', { page: ledger.page, total: ledger.totalPages })}
          </span>
          {page < ledger.totalPages ? (
            <Link href={`/sell/earnings?page=${page + 1}`}>{t('older')}</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
