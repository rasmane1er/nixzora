import {
  type PagedResult,
  type SellerBalance,
  type SellerLedgerEntryView,
} from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SellerBalanceCards } from '@/components/SellerBalanceCards';
import { SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';

/** Outside render: the current time is read when the page is built. */
function isFuture(iso: string): boolean {
  return Date.parse(iso) > Date.now();
}

export const metadata: Metadata = { title: 'Earnings', robots: { index: false } };

const TYPE_LABEL: Record<SellerLedgerEntryView['type'], string> = {
  SALE: 'Sale',
  REFUND: 'Refund',
  PAYOUT: 'Payout',
  ADJUSTMENT: 'Adjustment',
};

export default async function EarningsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const page = Number(param(params, 'page') ?? 1) || 1;
  const seller = await requireSeller('/sell/earnings');
  const [balance, ledger] = await Promise.all([
    api<SellerBalance>('/seller/balance'),
    api<PagedResult<SellerLedgerEntryView>>(`/seller/ledger?page=${page}`),
  ]);
  const money = (cents: number) => formatMoney(cents, balance.currency);
  const day = (iso: string) =>
    new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(iso));

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/earnings" />
      <SellerBalanceCards balance={balance} />
      <p className="muted" style={{ fontSize: 14 }}>
        Earnings are added when you ship an order and become available after your{' '}
        {seller.payoutHoldDays}-day hold
        {balance.nextReleaseAt ? `; the next release is on ${day(balance.nextReleaseAt)}` : ''}.
        Refunds of your items are deducted, with the commission on them returned to you.
        {seller.payouts.provider === 'FAKE' ? ' Test mode: no money moves.' : ''}
      </p>

      <section className="card">
        <h2>Activity</h2>
        {ledger.items.length === 0 ? (
          <p className="muted">Nothing yet. Ship your first order to start earning.</p>
        ) : (
          <table className="plain">
            <thead>
              <tr>
                <th>Date</th>
                <th>Activity</th>
                <th>Available</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {ledger.items.map((entry) => (
                <tr key={entry.id}>
                  <td>{day(entry.createdAt)}</td>
                  <td>
                    <strong>{TYPE_LABEL[entry.type]}</strong>{' '}
                    <span className="muted">{entry.description}</span>
                  </td>
                  <td>{isFuture(entry.availableAt) ? day(entry.availableAt) : 'Now'}</td>
                  <td className={`num ${entry.amountCents < 0 ? 'neg' : ''}`}>
                    {entry.amountCents > 0 ? '+' : ''}
                    {money(entry.amountCents)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
      {ledger.totalPages > 1 ? (
        <nav className="pager" aria-label="Pages">
          {page > 1 ? <Link href={`/sell/earnings?page=${page - 1}`}>← Newer</Link> : null}
          <span className="muted">
            Page {ledger.page} of {ledger.totalPages}
          </span>
          {page < ledger.totalPages ? (
            <Link href={`/sell/earnings?page=${page + 1}`}>Older →</Link>
          ) : null}
        </nav>
      ) : null}
    </div>
  );
}
