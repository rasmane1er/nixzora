import { type SellerAnalytics, type SellerAnalyticsTotals } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { SalesChart } from './SalesChart';

export const metadata: Metadata = { title: 'Analytics', robots: { index: false } };

const RANGES = [7, 30, 90] as const;

type Tile = {
  label: string;
  key: keyof SellerAnalyticsTotals;
  format: (value: number) => string;
  /** Whether a rise is good news (refunds are not). */
  upIsGood: boolean;
};

const money = (cents: number) => formatMoney(cents, 'USD');
const count = (n: number) => new Intl.NumberFormat('en-US').format(n);

const TILES: Tile[] = [
  { label: 'Sales', key: 'salesCents', format: money, upIsGood: true },
  { label: 'You earned', key: 'netCents', format: money, upIsGood: true },
  { label: 'Orders', key: 'orders', format: count, upIsGood: true },
  { label: 'Units sold', key: 'units', format: count, upIsGood: true },
  { label: 'Product views', key: 'views', format: count, upIsGood: true },
  { label: 'Refunded', key: 'refundedCents', format: money, upIsGood: false },
];

/** "+12% vs previous 30 days", or nothing when there is no previous figure to compare. */
function delta(now: number, before: number, days: number, upIsGood: boolean) {
  if (!before) return null;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return { text: `Same as the previous ${days} days`, tone: '' };
  const good = change > 0 === upIsGood;
  return {
    text: `${change > 0 ? '▲' : '▼'} ${Math.abs(change)}% vs previous ${days} days`,
    tone: good ? 'delta--good' : 'delta--bad',
  };
}

export default async function SellerAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const requested = Number(param(params, 'days'));
  const days = (RANGES as readonly number[]).includes(requested) ? requested : 30;
  const seller = await requireSeller('/sell/analytics');
  const stats = await api<SellerAnalytics>(`/seller/analytics?days=${days}`);
  const { totals, previous } = stats;

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/analytics" />
      <nav className="seller-filters" aria-label="Period">
        {RANGES.map((range) => (
          <Link
            key={range}
            href={`/sell/analytics?days=${range}`}
            aria-current={range === days ? 'page' : undefined}
          >
            Last {range} days
          </Link>
        ))}
      </nav>

      <div className="seller-stats seller-stats--six">
        {TILES.map((tile) => {
          const change = delta(totals[tile.key] ?? 0, previous[tile.key] ?? 0, days, tile.upIsGood);
          return (
            <div key={tile.key} className="card">
              <span className="muted">{tile.label}</span>
              <strong>{tile.format(totals[tile.key] ?? 0)}</strong>
              {change ? (
                <span className={`delta ${change.tone}`} style={{ fontSize: 13 }}>
                  {change.text}
                </span>
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>
                  No earlier sales to compare
                </span>
              )}
            </div>
          );
        })}
      </div>

      <section className="card stack">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>Daily sales</h2>
          <span className="muted" style={{ fontSize: 14 }}>
            {totals.conversionPct === null
              ? 'No product views yet'
              : `${totals.conversionPct} orders per 100 product views`}
          </span>
        </div>
        <SalesChart daily={stats.daily} />
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          Item sales before commission, by the day the order was paid (US Eastern time). Cancelled
          orders are left out.
        </p>
      </section>

      <section className="card stack">
        <h2>Top products</h2>
        {stats.topProducts.length === 0 ? (
          <p className="muted">
            No sales or views in this period yet.{' '}
            <Link href="/sell/listings">Check your listings →</Link>
          </p>
        ) : (
          <table className="plain">
            <thead>
              <tr>
                <th>Product</th>
                <th className="num">Views</th>
                <th className="num">Units</th>
                <th className="num">Sales</th>
              </tr>
            </thead>
            <tbody>
              {stats.topProducts.map((product) => (
                <tr key={product.productId}>
                  <td>
                    <Link href={`/sell/listings/${product.productId}`}>{product.title}</Link>
                  </td>
                  <td className="num">{count(product.views)}</td>
                  <td className="num">{count(product.units)}</td>
                  <td className="num">{money(product.salesCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
