import {
  BUSINESS_TYPES,
  type BusinessType,
  HANDLING_DAYS,
  SELLER_CARRIER_LABEL,
  SELLER_CARRIERS,
  SELLER_CATEGORIES,
  SHIP_REGIONS,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import { BrandingUpload } from '@/components/BrandingUpload';
import { VacationCard } from '@/components/VacationCard';
import { Notices, SellerNav } from '@/components/SellerNav';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { updateStore } from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sell');
  return { title: t('settingsTitle'), robots: { index: false } };
}

export default async function StoreSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/settings');
  const [t, ta, tc, td, f] = await Promise.all([
    getT('sell'),
    getT('sellApply'),
    getT('common'),
    getT('departments'),
    getFormat(),
  ]);
  const businessType = seller.businessType as BusinessType | null | undefined;

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/settings" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="two-col-sell">
        <form action={updateStore} className="card form">
          <h2>{t('storeProfile')}</h2>
          <label>
            {t('storeName')}
            <input name="displayName" required defaultValue={seller.displayName} maxLength={60} />
          </label>
          <label>
            {t('contactEmail')} <span className="hint">{t('contactEmailHint')}</span>
            <input name="contactEmail" type="email" required defaultValue={seller.contactEmail} />
          </label>
          <label>
            {t('aboutStore')} <span className="hint">{t('aboutStoreHint')}</span>
            <textarea
              name="description"
              rows={4}
              maxLength={1000}
              defaultValue={seller.description ?? ''}
            />
          </label>
          <div className="form-row">
            <label>
              {t('category')}
              <select name="category" defaultValue={seller.category ?? ''}>
                <option value="">{t('notSet')}</option>
                {SELLER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {td(c)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('website')} <span className="hint">{tc('optional')}</span>
              <input name="website" type="url" defaultValue={seller.website ?? ''} />
            </label>
          </div>
          <div className="form-row">
            <label>
              {t('supportEmail')} <span className="hint">{t('publicHint')}</span>
              <input name="supportEmail" type="email" defaultValue={seller.supportEmail ?? ''} />
            </label>
            <label>
              {t('supportPhone')} <span className="hint">{t('publicHint')}</span>
              <input name="supportPhone" type="tel" defaultValue={seller.supportPhone ?? ''} />
            </label>
          </div>
          <h3>{t('branding')}</h3>
          <BrandingUpload
            kind="logo"
            urlValue={seller.logoUrl ?? undefined}
            keyValue={seller.logoUrl ? 'keep' : undefined}
          />
          <BrandingUpload
            kind="banner"
            urlValue={seller.bannerUrl ?? undefined}
            keyValue={seller.bannerUrl ? 'keep' : undefined}
          />
          <h3>{t('shipping')}</h3>
          <label>
            {ta('shippedWithin')}
            <select name="handlingDays" defaultValue={String(seller.shipping.handlingDays)}>
              {HANDLING_DAYS.map((d) => (
                <option key={d} value={d}>
                  {ta('businessDays', { count: d })}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>{t('carriers')}</legend>
            <div className="check-grid">
              {SELLER_CARRIERS.map((c) => (
                <label key={c} className="check">
                  <input
                    type="checkbox"
                    name="carriers"
                    value={c}
                    defaultChecked={seller.shipping.carriers.includes(c)}
                  />
                  <span>{c === 'OTHER' ? ta('carrier_OTHER') : SELLER_CARRIER_LABEL[c]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>{ta('shippingRegions')}</legend>
            <div className="check-grid">
              {SHIP_REGIONS.map((r) => (
                <label key={r} className="check">
                  <input
                    type="checkbox"
                    name="shipRegions"
                    value={r}
                    defaultChecked={seller.shipping.shipRegions.includes(r)}
                  />
                  <span>{ta(`region_${r}`)}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <button className="btn btn--primary" type="submit">
              {tc('save')}
            </button>
          </div>
        </form>

        <section className="card stack">
          <h2>{t('businessAndPayouts')}</h2>
          <dl className="facts">
            <dt>{t('legalName')}</dt>
            <dd>{seller.legalName}</dd>
            {businessType ? (
              <>
                <dt>{ta('businessType')}</dt>
                <dd>
                  {BUSINESS_TYPES.includes(businessType)
                    ? ta(`businessType_${businessType}`)
                    : businessType}
                </dd>
              </>
            ) : null}
            {seller.address ? (
              <>
                <dt>{ta('businessAddress')}</dt>
                <dd>
                  {seller.address.line1}
                  {seller.address.line2 ? `, ${seller.address.line2}` : ''}, {seller.address.city},{' '}
                  {seller.address.region} {seller.address.postalCode}
                </dd>
              </>
            ) : null}
            <dt>{t('storeAddress')}</dt>
            <dd className="mono">nixzora.com/s/{seller.handle}</dd>
            <dt>{t('commission')}</dt>
            <dd>{t('commissionValue', { rate: f.percent(seller.commissionBps / 10_000) })}</dd>
            <dt>{t('payoutHold')}</dt>
            <dd>{t('payoutHoldValue', { days: seller.payoutHoldDays })}</dd>
            <dt>{t('payouts')}</dt>
            <dd>
              {seller.payouts.payoutsEnabled
                ? `${t('payoutsOn')}${seller.payouts.provider === 'FAKE' ? t('payoutsTestMode') : ''}`
                : seller.payouts.detailsSubmitted
                  ? t('payoutsVerifying')
                  : t('payoutsNotSetUp')}
            </dd>
          </dl>
          {seller.payouts.requirementsDue.length ? (
            <p className="banner banner--info">{t('stripeNeedsMore')}</p>
          ) : null}
          <div>
            <a className="btn btn--secondary" href="/sell/payouts/start">
              {seller.payouts.accountConnected ? t('updatePayouts') : t('setUpPayouts')}
            </a>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            {t('supportChanges')}
          </p>
        </section>
      </div>
      <VacationCard seller={seller} />
    </div>
  );
}
