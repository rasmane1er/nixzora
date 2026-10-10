import { INTL_LOCALE } from '@nixzora/i18n';
import { PRICE_HISTORY_RANGES, type PriceHistory } from '@nixzora/validation';
import Link from 'next/link';
import { PriceChart } from '@/components/PriceChart';
import { api } from '@/lib/api';
import { getFormat, getLocale, getT } from '@/lib/i18n';

/** Price history on a product page (p10-19): range links, the chart, and the key numbers. */
export async function PriceHistorySection({ slug, days }: { slug: string; days: number }) {
  const history = await api<PriceHistory>(`/catalog/products/${slug}/price-history?days=${days}`, {
    auth: false,
    revalidate: 300,
  }).catch(() => null);
  if (!history) return null;
  const [t, f, locale] = await Promise.all([getT('history'), getFormat(), getLocale()]);
  const first = history.points[0]!.priceCents;
  return (
    <section className="section card price-history" id="price-history" aria-labelledby="ph-title">
      <div className="price-history__head">
        <h2 id="ph-title">{t('priceTitle')}</h2>
        <nav className="seller-tabs" aria-label={t('priceTitle')}>
          {PRICE_HISTORY_RANGES.map((range) => (
            <Link
              key={range}
              href={`/p/${slug}?ph=${range}#price-history`}
              scroll={false}
              aria-current={range === history.days ? 'page' : undefined}
            >
              {t(`range_${range}`)}
            </Link>
          ))}
        </nav>
      </div>
      {history.changed ? (
        <>
          <dl className="price-history__stats">
            <div>
              <dt>{t('today')}</dt>
              <dd>{f.money(history.currentCents)}</dd>
            </div>
            <div>
              <dt>{t('lowest')}</dt>
              <dd>{f.money(history.lowestCents)}</dd>
            </div>
            <div>
              <dt>{t('typical')}</dt>
              <dd>{f.money(history.typicalCents)}</dd>
            </div>
            <div>
              <dt>{t('highest')}</dt>
              <dd>{f.money(history.highestCents)}</dd>
            </div>
          </dl>
          <PriceChart
            history={history}
            locale={INTL_LOCALE[locale]}
            labels={{
              chartLabel: t('chartLabel', {
                days: history.days,
                first: f.money(first),
                last: f.money(history.currentCents),
                lowest: f.money(history.lowestCents),
              }),
              tableSummary: t('tableSummary'),
              colDate: t('colDate'),
              colPrice: t('colPrice'),
              today: t('today'),
            }}
          />
        </>
      ) : (
        <p className="muted" style={{ margin: 0 }}>
          {t('steady', { days: history.days })}
        </p>
      )}
    </section>
  );
}

/** "Lowest price in 30 days" beside the price (p10-19), when it is. */
export async function LowestPriceBadge({ slug }: { slug: string }) {
  const history = await api<PriceHistory>(`/catalog/products/${slug}/price-history?days=90`, {
    auth: false,
    revalidate: 300,
  }).catch(() => null);
  if (!history?.lowestIn30Days) return null;
  const t = await getT('history');
  return <span className="lowest-badge">{t('lowestIn30')}</span>;
}
