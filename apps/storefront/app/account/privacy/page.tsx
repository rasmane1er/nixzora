import { type MeResponse } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { param, type SearchParams } from '@/lib/params';
import { closeAccount } from '../hub-actions';

export const metadata: Metadata = { title: 'Your data & privacy', robots: { index: false } };

export default async function PrivacyPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const me = await accountApi<MeResponse>('/auth/me', '/account/privacy');

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title="Your data & privacy"
        description="See what we keep about you, take a copy, or close your account."
      />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <div className="account-grid">
        <section className="card stack">
          <h2>Download your data</h2>
          <p className="muted" style={{ margin: 0 }}>
            A JSON file with your profile, preferences, addresses, orders, returns, reviews,
            wishlist and signed-in devices. Payment card details are never stored by NIXZORA, so
            they are not in it.
          </p>
          <div>
            <a className="btn btn--primary" href="/account/export" download>
              Download my data
            </a>
          </div>
          <p className="hint">
            How we use your data is in the <Link href="/privacy">privacy notice</Link>.
          </p>
        </section>

        <section className="card stack" id="close">
          <h2>Close your account</h2>
          <p className="muted" style={{ margin: 0 }}>
            We delete your name, phone, addresses, wishlist and sign-ins, and stop all emails.
            Orders stay in our records for tax and accounting, and published reviews stay without
            your name. This cannot be undone.
          </p>
          <details>
            <summary>Close my account</summary>
            <form action={closeAccount} className="form" style={{ marginTop: 12 }}>
              {me.hasPassword ? (
                <label>
                  Your password
                  <input name="password" type="password" autoComplete="current-password" required />
                </label>
              ) : (
                <label>
                  Type DELETE to confirm
                  <input name="confirm" required pattern="DELETE" autoComplete="off" />
                </label>
              )}
              <label className="check">
                <input type="checkbox" name="understand" required /> I understand this deletes my
                account for good.
              </label>
              <div>
                <button className="btn btn--danger" type="submit">
                  Close account
                </button>
              </div>
            </form>
          </details>
        </section>
      </div>
    </div>
  );
}
