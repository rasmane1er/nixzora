import { rich } from '@nixzora/i18n';
import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { LanguagePicker } from '@/components/LanguagePicker';
import { accountApi } from '@/lib/account';
import { getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { THEME_COOKIE } from '@/lib/session';
import { setTheme } from '../hub-actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('account');
  return { title: t('settings'), robots: { index: false } };
}

const THEMES = [
  { value: 'system', label: 'themeSystem', hint: 'themeSystemHint' },
  { value: 'light', label: 'themeLight', hint: 'themeLightHint' },
  { value: 'dark', label: 'themeDark', hint: 'themeDarkHint' },
] as const;

export default async function SettingsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  await accountApi('/me/profile', '/account/settings');
  const current = (await cookies()).get(THEME_COOKIE)?.value ?? 'system';
  const [t, tc] = await Promise.all([getT('account'), getT('common')]);

  return (
    <div className="wrap section stack" style={{ gap: 20, maxWidth: 820 }}>
      <AccountHeader title={t('settings')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <form action={setTheme} className="card form">
        <h2>{t('appearance')}</h2>
        <fieldset className="pref-list">
          <legend className="sr-only">{t('theme')}</legend>
          {THEMES.map((theme) => (
            <label key={theme.value} className="pref">
              <input
                type="radio"
                name="theme"
                value={theme.value}
                defaultChecked={current === theme.value}
              />
              <span className="stack" style={{ gap: 2 }}>
                <strong>{t(theme.label)}</strong>
                <span className="muted">{t(theme.hint)}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div>
          <button className="btn btn--primary" type="submit">
            {tc('save')}
          </button>
        </div>
        <p className="hint">{t('themeSavedHint')}</p>
      </form>

      <section className="card stack">
        <h2>{t('region')}</h2>
        <dl className="facts">
          <dt>{tc('language')}</dt>
          <dd>
            <LanguagePicker id="settings-language" />
          </dd>
          <dt>{t('currency')}</dt>
          <dd>{t('currencyValue')}</dd>
          <dt>{t('shipsTo')}</dt>
          <dd>{t('unitedStates')}</dd>
        </dl>
        <p className="hint">
          {t('languageHint')} {t('regionHint')}
        </p>
      </section>

      <section className="card stack">
        <h2>{t('emailsNotifications')}</h2>
        <p style={{ margin: 0 }}>
          {rich(t('emailsNotificationsText'), {
            link: (chunk) => (
              <Link key="preferences" href="/account/preferences">
                {chunk}
              </Link>
            ),
          })}
        </p>
      </section>
    </div>
  );
}
