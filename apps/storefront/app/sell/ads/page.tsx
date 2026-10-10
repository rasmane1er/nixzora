import {
  AD_MIN_BID_CENTS,
  AD_MIN_DAILY_BUDGET_CENTS,
  type AdCampaignView,
  type AdStats,
  type SellerAdsOverview,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { createCampaign, setCampaignStatus, updateCampaign } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ads');
  return { title: t('metaAds'), robots: { index: false } };
}

type Product = SellerAdsOverview['promotable'][number];

/** "12.50" for an input's default value. */
const asDollars = (cents: number) => (cents / 100).toFixed(2);

function total(days: AdStats[]): AdStats {
  return days.reduce(
    (sum, d) => ({
      impressions: sum.impressions + d.impressions,
      clicks: sum.clicks + d.clicks,
      spendCents: sum.spendCents + d.spendCents,
    }),
    { impressions: 0, clicks: 0, spendCents: 0 },
  );
}

/** The products to promote, as checkboxes with a thumbnail. */
function ProductChoices({
  products,
  chosen,
  legend,
}: {
  products: Product[];
  chosen: Set<string>;
  legend: string;
}) {
  return (
    <fieldset className="ad-products">
      <legend>{legend}</legend>
      {products.map((product) => (
        <label key={product.id} className="ad-product">
          <input
            type="checkbox"
            name="productIds"
            value={product.id}
            defaultChecked={chosen.has(product.id)}
          />
          {product.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- small listing thumbnail
            <img src={product.imageUrl} alt="" width={40} height={30} loading="lazy" />
          ) : null}
          <span>{product.title}</span>
        </label>
      ))}
    </fieldset>
  );
}

export default async function SellerAdsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/ads');
  const [overview, t, f] = await Promise.all([
    api<SellerAdsOverview>('/seller/ads'),
    getT('ads'),
    getFormat(),
  ]);
  const money = (cents: number) => f.money(cents);
  const last14 = total(overview.daily);
  const rate = last14.impressions ? last14.clicks / last14.impressions : 0;
  const perClick = last14.clicks ? Math.round(last14.spendCents / last14.clicks) : 0;
  const statsLine = (s: AdStats) =>
    t('statsLine', {
      impressions: f.number(s.impressions),
      clicks: f.number(s.clicks),
      spend: money(s.spendCents),
    });

  const campaignFields = (campaign?: AdCampaignView) => (
    <>
      <label>
        {t('campaignName')}
        <input
          name="name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={campaign?.name}
          placeholder={campaign ? undefined : t('campaignNamePlaceholder')}
        />
      </label>
      <ProductChoices
        products={overview.promotable}
        chosen={new Set(campaign?.products.map((p) => p.id) ?? [])}
        legend={t('productsToPromote')}
      />
      <div className="form-row">
        <label>
          {t('dailyBudget')}
          <input
            name="dailyBudget"
            inputMode="decimal"
            required
            defaultValue={campaign ? asDollars(campaign.dailyBudgetCents) : '5.00'}
            aria-describedby="budget-hint"
          />
          <span className="hint" id="budget-hint">
            {t('dailyBudgetHint', { min: money(AD_MIN_DAILY_BUDGET_CENTS) })}
          </span>
        </label>
        <label>
          {t('bid')}
          <input
            name="bid"
            inputMode="decimal"
            required
            defaultValue={campaign ? asDollars(campaign.bidCents) : '0.50'}
            aria-describedby="bid-hint"
          />
          <span className="hint" id="bid-hint">
            {t('bidHint', { min: money(AD_MIN_BID_CENTS) })}
          </span>
        </label>
        <label>
          {t('endsOn')}
          <input name="endsOn" type="date" defaultValue={campaign?.endsOn ?? undefined} />
        </label>
      </div>
    </>
  );

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/ads" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <section className="stack" style={{ gap: 6 }}>
        <h2>{t('title')}</h2>
        <p className="muted" style={{ maxWidth: '70ch' }}>
          {t('lead')}
        </p>
      </section>

      <div className="seller-stats">
        {(
          [
            ['credit', t('credit'), money(overview.creditCents)],
            ['funds', t('funds'), money(overview.fundsCents)],
            ['unbilled', t('unbilled'), money(overview.unbilledCents)],
          ] as const
        ).map(([key, label, value]) => (
          <div key={key} className="card">
            <span className="muted">{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 14, marginTop: -8 }}>
        {t('fundsHint')} <Link href="/sell/earnings">→</Link>
      </p>

      <section className="card stack">
        <h2>{t('last14')}</h2>
        <div className="seller-stats seller-stats--six">
          {(
            [
              ['impressions', t('impressions'), f.number(last14.impressions)],
              ['clicks', t('clicks'), f.number(last14.clicks)],
              ['spend', t('spend'), money(last14.spendCents)],
              ['rate', t('clickRate'), f.percent(rate)],
              ['cpc', t('perClickAverage'), money(perClick)],
            ] as const
          ).map(([key, label, value]) => (
            <div key={key} className="card">
              <span className="muted">{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
        </div>
      </section>

      <section className="card stack" aria-labelledby="campaigns-title">
        <h2 id="campaigns-title">{t('campaigns')}</h2>
        {overview.campaigns.length === 0 ? (
          <p className="muted">{t('noCampaigns')}</p>
        ) : (
          <ul className="ad-campaigns">
            {overview.campaigns.map((campaign) => (
              <li key={campaign.id} className="ad-campaign">
                <div className="ad-campaign__head">
                  <strong>{campaign.name}</strong>
                  <span className={`pill pill--ad-${campaign.status.toLowerCase()}`}>
                    {campaign.ended ? t('ended') : t(`status_${campaign.status}`)}
                  </span>
                </div>
                {campaign.status === 'SUSPENDED' && campaign.suspendedReason ? (
                  <p className="banner banner--error">
                    {t('suspendedBecause', { reason: campaign.suspendedReason })}
                  </p>
                ) : null}
                <p className="muted" style={{ margin: 0, fontSize: 14 }}>
                  {t('budgetPerDay', { amount: money(campaign.dailyBudgetCents) })} ·{' '}
                  {t('bidUpTo', { amount: money(campaign.bidCents) })} ·{' '}
                  {campaign.products.map((p) => p.title).join(', ')}
                </p>
                <dl className="ad-campaign__stats">
                  <div>
                    <dt>{t('today')}</dt>
                    <dd>{statsLine(campaign.today)}</dd>
                  </div>
                  <div>
                    <dt>{t('last30')}</dt>
                    <dd>{statsLine(campaign.last30Days)}</dd>
                  </div>
                </dl>
                <div className="ad-campaign__actions">
                  {campaign.status !== 'SUSPENDED' ? (
                    <form action={setCampaignStatus}>
                      <input type="hidden" name="id" value={campaign.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={campaign.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE'}
                      />
                      <button className="btn btn--secondary btn--sm" type="submit">
                        {campaign.status === 'ACTIVE' ? t('pause') : t('resume')}
                      </button>
                    </form>
                  ) : null}
                  {overview.promotable.length ? (
                    <details>
                      <summary className="btn btn--secondary btn--sm">{t('editCampaign')}</summary>
                      <form action={updateCampaign} className="form" style={{ marginTop: 12 }}>
                        <input type="hidden" name="id" value={campaign.id} />
                        {campaignFields(campaign)}
                        <div>
                          <button className="btn btn--primary" type="submit">
                            {t('saveChanges')}
                          </button>
                        </div>
                      </form>
                    </details>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack" aria-labelledby="new-campaign">
        <h2 id="new-campaign">{t('newCampaign')}</h2>
        {overview.promotable.length ? (
          <form action={createCampaign} className="form">
            {campaignFields()}
            <p className="hint">{t('policyNote')}</p>
            <div>
              <button className="btn btn--primary" type="submit">
                {t('startCampaign')}
              </button>
            </div>
          </form>
        ) : (
          <p className="muted">{t('noListings')}</p>
        )}
      </section>
    </div>
  );
}
