import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { param, type SearchParams } from '@/lib/params';
import { THEME_COOKIE } from '@/lib/session';
import { setTheme } from '../hub-actions';

export const metadata: Metadata = { title: 'Settings', robots: { index: false } };

const THEMES = [
  {
    value: 'system',
    label: 'Match my device',
    hint: 'Light or dark, following your system setting.',
  },
  { value: 'light', label: 'Light', hint: 'Always light.' },
  { value: 'dark', label: 'Dark', hint: 'Always dark, easier on the eyes at night.' },
];

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await accountApi('/me/profile', '/account/settings');
  const current = (await cookies()).get(THEME_COOKIE)?.value ?? 'system';

  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 820 }}>
      <AccountHeader title="Settings" />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <form action={setTheme} className="card form">
        <h2>Appearance</h2>
        <fieldset className="pref-list">
          <legend className="sr-only">Theme</legend>
          {THEMES.map((t) => (
            <label key={t.value} className="pref">
              <input
                type="radio"
                name="theme"
                value={t.value}
                defaultChecked={current === t.value}
              />
              <span className="stack" style={{ gap: 2 }}>
                <strong>{t.label}</strong>
                <span className="muted">{t.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div>
          <button className="btn btn--primary" type="submit">
            Save
          </button>
        </div>
        <p className="hint">Saved on this browser. The app has its own setting.</p>
      </form>

      <section className="card stack">
        <h2>Region</h2>
        <dl className="facts">
          <dt>Language</dt>
          <dd>English (United States)</dd>
          <dt>Currency</dt>
          <dd>US dollar (USD)</dd>
          <dt>Ships to</dt>
          <dd>United States</dd>
        </dl>
        <p className="hint">
          More languages and currencies will come as NIXZORA ships to more countries.
        </p>
      </section>

      <section className="card stack">
        <h2>Emails and notifications</h2>
        <p style={{ margin: 0 }}>
          Choose which emails you get in <Link href="/account/preferences">Notifications</Link>.
          Push notifications for order updates are switched on in the NIXZORA app.
        </p>
      </section>
    </div>
  );
}
