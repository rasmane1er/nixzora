import { type AccountPreferences } from '@nixzora/validation';
import type { Metadata } from 'next';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { param, type SearchParams } from '@/lib/params';
import { savePreferences } from '../hub-actions';

export const metadata: Metadata = { title: 'Communication preferences', robots: { index: false } };

export default async function PreferencesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const prefs = await accountApi<AccountPreferences>('/me/preferences', '/account/preferences');

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title="Communication"
        description="Choose which emails you get from NIXZORA."
      />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />
      <form action={savePreferences} className="card form" style={{ maxWidth: 720 }}>
        <fieldset className="pref-list">
          <legend className="sr-only">Emails</legend>
          <label className="pref">
            <input type="checkbox" checked disabled aria-describedby="pref-orders" />
            <span className="stack" style={{ gap: 2 }}>
              <strong>Orders and account</strong>
              <span className="muted" id="pref-orders">
                Order confirmations, shipping and delivery updates, refunds, and security alerts.
                Always on: we need to reach you about your orders.
              </span>
            </span>
          </label>
          <label className="pref">
            <input type="checkbox" name="reviewRequests" defaultChecked={prefs.reviewRequests} />
            <span className="stack" style={{ gap: 2 }}>
              <strong>Review requests</strong>
              <span className="muted">One email after delivery asking how the product is.</span>
            </span>
          </label>
          <label className="pref">
            <input type="checkbox" name="marketingEmails" defaultChecked={prefs.marketingEmails} />
            <span className="stack" style={{ gap: 2 }}>
              <strong>Deals and new arrivals</strong>
              <span className="muted">
                Occasional offers and new products. Every email has a one-click unsubscribe link.
              </span>
            </span>
          </label>
        </fieldset>
        <div>
          <button className="btn btn--primary" type="submit">
            Save preferences
          </button>
        </div>
        <p className="hint">Push notifications on your phone are set in the NIXZORA app.</p>
      </form>
    </div>
  );
}
