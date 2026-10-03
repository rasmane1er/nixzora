import {
  BUSINESS_TYPE_LABEL,
  type BusinessType,
  HANDLING_DAYS,
  SELLER_CARRIER_LABEL,
  SELLER_CARRIERS,
  SELLER_CATEGORIES,
  SELLER_CATEGORY_LABEL,
  SHIP_REGION_LABEL,
  SHIP_REGIONS,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import { BrandingUpload } from '@/components/BrandingUpload';
import { Notices, SellerNav } from '@/components/SellerNav';
import { param, type SearchParams } from '@/lib/params';
import { requireSeller } from '@/lib/sell';
import { updateStore } from '../actions';

export const metadata: Metadata = { title: 'Store settings', robots: { index: false } };

export default async function StoreSettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const seller = await requireSeller('/sell/settings');

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/settings" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="two-col-sell">
        <form action={updateStore} className="card form">
          <h2>Store profile</h2>
          <label>
            Store name
            <input name="displayName" required defaultValue={seller.displayName} maxLength={60} />
          </label>
          <label>
            Contact email <span className="hint">For orders and payouts.</span>
            <input name="contactEmail" type="email" required defaultValue={seller.contactEmail} />
          </label>
          <label>
            About your store <span className="hint">Shown on your store page.</span>
            <textarea
              name="description"
              rows={4}
              maxLength={1000}
              defaultValue={seller.description ?? ''}
            />
          </label>
          <div className="form-row">
            <label>
              Category
              <select name="category" defaultValue={seller.category ?? ''}>
                <option value="">Not set</option>
                {SELLER_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {SELLER_CATEGORY_LABEL[c]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Website <span className="hint">Optional.</span>
              <input name="website" type="url" defaultValue={seller.website ?? ''} />
            </label>
          </div>
          <div className="form-row">
            <label>
              Support email <span className="hint">Public.</span>
              <input name="supportEmail" type="email" defaultValue={seller.supportEmail ?? ''} />
            </label>
            <label>
              Support phone <span className="hint">Public.</span>
              <input name="supportPhone" type="tel" defaultValue={seller.supportPhone ?? ''} />
            </label>
          </div>
          <h3>Branding</h3>
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
          <h3>Shipping</h3>
          <label>
            Orders shipped within
            <select name="handlingDays" defaultValue={String(seller.shipping.handlingDays)}>
              {HANDLING_DAYS.map((d) => (
                <option key={d} value={d}>
                  {d} business {d === 1 ? 'day' : 'days'}
                </option>
              ))}
            </select>
          </label>
          <fieldset>
            <legend>Carriers</legend>
            <div className="check-grid">
              {SELLER_CARRIERS.map((c) => (
                <label key={c} className="check">
                  <input
                    type="checkbox"
                    name="carriers"
                    value={c}
                    defaultChecked={seller.shipping.carriers.includes(c)}
                  />
                  <span>{SELLER_CARRIER_LABEL[c]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Shipping regions</legend>
            <div className="check-grid">
              {SHIP_REGIONS.map((r) => (
                <label key={r} className="check">
                  <input
                    type="checkbox"
                    name="shipRegions"
                    value={r}
                    defaultChecked={seller.shipping.shipRegions.includes(r)}
                  />
                  <span>{SHIP_REGION_LABEL[r]}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <button className="btn btn--primary" type="submit">
              Save
            </button>
          </div>
        </form>

        <section className="card stack">
          <h2>Business and payouts</h2>
          <dl className="facts">
            <dt>Legal name</dt>
            <dd>{seller.legalName}</dd>
            {seller.businessType ? (
              <>
                <dt>Business type</dt>
                <dd>{BUSINESS_TYPE_LABEL[seller.businessType as BusinessType]}</dd>
              </>
            ) : null}
            {seller.address ? (
              <>
                <dt>Business address</dt>
                <dd>
                  {seller.address.line1}
                  {seller.address.line2 ? `, ${seller.address.line2}` : ''}, {seller.address.city},{' '}
                  {seller.address.region} {seller.address.postalCode}
                </dd>
              </>
            ) : null}
            <dt>Store address</dt>
            <dd className="mono">nixzora.com/s/{seller.handle}</dd>
            <dt>Commission</dt>
            <dd>{seller.commissionBps / 100}% of each sale</dd>
            <dt>Payout hold</dt>
            <dd>{seller.payoutHoldDays} days after shipping</dd>
            <dt>Payouts</dt>
            <dd>
              {seller.payouts.payoutsEnabled
                ? `On${seller.payouts.provider === 'FAKE' ? ' (test mode: no money moves)' : ''}`
                : seller.payouts.detailsSubmitted
                  ? 'Being verified'
                  : 'Not set up'}
            </dd>
          </dl>
          {seller.payouts.requirementsDue.length ? (
            <p className="banner banner--info">
              Stripe needs a few more details before paying you out.
            </p>
          ) : null}
          <div>
            <a className="btn btn--secondary" href="/sell/payouts/start">
              {seller.payouts.accountConnected ? 'Update payout details' : 'Set up payouts'}
            </a>
          </div>
          <p className="muted" style={{ fontSize: 13 }}>
            Legal name, business address and store address changes go through seller support.
          </p>
        </section>
      </div>
    </div>
  );
}
