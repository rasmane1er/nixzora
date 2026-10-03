import { type SellerAnalytics, type SellerAnalyticsTotals } from '@nixzora/validation';
import { type Formatters, type MessageKey, type Translate } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { SalesChart } from './SalesChart';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellerTools');
  return { title: t('metaAnalytics'), robots: { index: false } };
}

const RANGES = [7, 30, 90] as const;

type Tile = {
  label: MessageKey<'sellerTools'>;
  key: keyof SellerAnalyticsTotals;
  kind: 'money' | 'count';
  /** Whether a rise is good news (refunds are not). */
  upIsGood: boolean;
};

const TILES: Tile[] = [
  { label: 'tileSales', key: 'salesCents', kind: 'money', upIsGood: true },
  { label: 'tileEarned', key: 'netCents', kind: 'money', upIsGood: true },
  { label: 'tileOrders', key: 'orders', kind: 'count', upIsGood: true },
  { label: 'tileUnits', key: 'units', kind: 'count', upIsGood: true },
  { label: 'tileViews', key: 'views', kind: 'count', upIsGood: true },
  { label: 'tileRefunded', key: 'refundedCents', kind: 'money', upIsGood: false },
];

/** "+12% vs previous 30 days", or nothing when there is no previous figure to compare. */
function delta(
  t: Translate<'sellerTools'>,
  f: Formatters,
  now: number,
  before: number,
  days: number,
  upIsGood: boolean,
) {
  if (!before) return null;
  const change = Math.round(((now - before) / before) * 100);
  if (change === 0) return { text: t('deltaSame', { days }), tone: '' };
  const good = change > 0 === upIsGood;
  return {
    text: t('deltaChange', {
      arrow: change > 0 ? '▲' : '▼',
      change: f.percent(Math.abs(change) / 100),
      days,
    }),
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
  const [t, f] = await Promise.all([getT('sellerTools'), getFormat()]);
  const money = (cents: number) => f.money(cents, 'USD');
  const count = (n: number) => f.number(n);

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/analytics" />
      <nav className="seller-filters" aria-label={t('periodLabel')}>
        {RANGES.map((range) => (
          <Link
            key={range}
            href={`/sell/analytics?days=${range}`}
            aria-current={range === days ? 'page' : undefined}
          >
            {t('lastDays', { days: range })}
          </Link>
        ))}
      </nav>

      <div className="seller-stats seller-stats--six">
        {TILES.map((tile) => {
          const change = delta(
            t,
            f,
            totals[tile.key] ?? 0,
            previous[tile.key] ?? 0,
            days,
            tile.upIsGood,
          );
          const value = totals[tile.key] ?? 0;
          return (
            <div key={tile.key} className="card">
              <span className="muted">{t(tile.label)}</span>
              <strong>{tile.kind === 'money' ? money(value) : count(value)}</strong>
              {change ? (
                <span className={`delta ${change.tone}`} style={{ fontSize: 13 }}>
                  {change.text}
                </span>
              ) : (
                <span className="muted" style={{ fontSize: 13 }}>
                  {t('noEarlierSales')}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <section className="card stack">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>{t('dailySales')}</h2>
          <span className="muted" style={{ fontSize: 14 }}>
            {totals.conversionPct === null
              ? t('noViewsYet')
              : t('conversion', { rate: f.number(totals.conversionPct) })}
          </span>
        </div>
        <SalesChart daily={stats.daily} />
        <p className="muted" style={{ fontSize: 13, margin: 0 }}>
          {t('chartNote')}
        </p>
      </section>

      <section className="card stack">
        <h2>{t('topProducts')}</h2>
        {stats.topProducts.length === 0 ? (
          <p className="muted">
            {t('noTopProducts')} <Link href="/sell/listings">{t('checkListings')}</Link>
          </p>
        ) : (
          <div className="table-scroll">
            <table className="plain">
              <thead>
                <tr>
                  <th>{t('colProduct')}</th>
                  <th className="num">{t('colViews')}</th>
                  <th className="num">{t('colUnits')}</th>
                  <th className="num">{t('colSales')}</th>
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
          </div>
        )}
      </section>
    </div>
  );
}
