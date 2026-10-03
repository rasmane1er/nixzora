import type { Metadata } from 'next';
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
            <dt>Store address</dt>
            <dd className="mono">nixzora.com/s/{seller.handle}</dd>
            <dt>Commission</dt>
            <dd>{seller.commissionBps / 100}% of each sale</dd>
            <dt>Payout hold</dt>
            <dd>{seller.payoutHoldDays} days after delivery</dd>
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
            Legal name and store address changes go through seller support.
          </p>
        </section>
      </div>
    </div>
  );
}
