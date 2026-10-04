import { INTL_LOCALE, rich, type Translate } from '@nixzora/i18n';
import {
  type AccountProfile,
  type DeviceSignInSummary,
  type MeResponse,
  type PasskeySummary,
  type SessionSummary,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { PasskeyAdd } from '@/components/PasskeyAdd';
import { accountApi } from '@/lib/account';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import {
  changePassword,
  disableMfa,
  resendVerification,
  signOutDevice,
  signOutOtherDevices,
} from '../hub-actions';
import { removePasskey, revokeDeviceSignIn } from '../passkey-actions';
import { TwoStepSetup } from './TwoStep';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('account');
  return { title: t('securityTitle'), robots: { index: false } };
}

/** "Chrome on macOS" from a user agent, for the device list. */
function deviceLabel(session: SessionSummary, t: Translate<'account'>): string {
  if (session.deviceName && session.deviceName !== 'NIXZORA web') return session.deviceName;
  const ua = session.userAgent ?? '';
  const browser = /Edg\//.test(ua)
    ? 'Edge'
    : /Chrome\//.test(ua)
      ? 'Chrome'
      : /Firefox\//.test(ua)
        ? 'Firefox'
        : /Safari\//.test(ua)
          ? 'Safari'
          : null;
  const os = /iPhone|iPad/.test(ua)
    ? 'iOS'
    : /Android/.test(ua)
      ? 'Android'
      : /Mac OS X/.test(ua)
        ? 'macOS'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Linux/.test(ua)
            ? 'Linux'
            : null;
  if (browser && os) return t('browserOnOs', { browser, os });
  return session.deviceName ?? t('unknownDevice');
}

export default async function SecurityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [profile, me, sessions, passkeys, appSignIns] = await Promise.all([
    accountApi<AccountProfile>('/me/profile', '/account/security'),
    accountApi<MeResponse>('/auth/me', '/account/security'),
    accountApi<SessionSummary[]>('/me/sessions', '/account/security'),
    accountApi<PasskeySummary[]>('/me/passkeys', '/account/security'),
    accountApi<DeviceSignInSummary[]>('/me/device-sign-ins', '/account/security'),
  ]);
  const others = sessions.filter((s) => !s.current).length;
  const [t, tc, f, locale] = await Promise.all([
    getT('account'),
    getT('common'),
    getFormat(),
    getLocale(),
  ]);
  const providerNames = (providers: string[]) =>
    new Intl.ListFormat(INTL_LOCALE[locale], { type: 'conjunction' }).format(providers);

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader title={t('securityTitle')} description={t('securityDescription')} />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <div className="account-grid">
        <section className="card stack">
          <h2>{t('profile')}</h2>
          <p style={{ margin: 0 }}>
            {[profile.firstName, profile.lastName].filter(Boolean).join(' ') || t('noNameYet')}
            {profile.phone ? ` · ${profile.phone}` : ''}
          </p>
          <div>
            <a className="btn btn--secondary btn--sm" href="/account/profile">
              {t('editProfile')}
            </a>
          </div>
        </section>

        <section className="card stack">
          <h2>{t('email')}</h2>
          <p style={{ margin: 0 }}>
            <strong>{profile.email}</strong>{' '}
            {profile.emailVerified ? (
              <span className="pill pill--delivered">{t('confirmed')}</span>
            ) : (
              <span className="pill pill--pending_payment">{t('notConfirmed')}</span>
            )}
          </p>
          {!profile.emailVerified ? (
            <form action={resendVerification}>
              <button className="btn btn--secondary btn--sm" type="submit">
                {t('sendConfirmationAgain')}
              </button>
            </form>
          ) : null}
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            {t('emailNote')}
          </p>
          {me.linkedProviders.length ? (
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              {t('alsoSignInWith', {
                providers: providerNames(
                  me.linkedProviders.map((p) => (p === 'google' ? 'Google' : 'Apple')),
                ),
              })}
            </p>
          ) : null}
        </section>

        <section className="card stack" id="password">
          <h2>{t('password')}</h2>
          {me.hasPassword ? (
            <form action={changePassword} className="form">
              <label>
                {t('currentPassword')}
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                {t('newPassword')} <span className="hint">{t('newPasswordHint')}</span>
                <input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>
              <label>
                {t('newPasswordAgain')}
                <input
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>
              <div>
                <button className="btn btn--primary" type="submit">
                  {t('changePassword')}
                </button>
              </div>
              <p className="hint">{t('changeSignsOut')}</p>
            </form>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              {rich(
                t('noPassword', {
                  provider: me.linkedProviders.includes('apple') ? 'Apple' : 'Google',
                }),
                {
                  link: (chunk) => (
                    <a key="forgot" href="/account/forgot-password">
                      {chunk}
                    </a>
                  ),
                },
              )}
            </p>
          )}
        </section>

        <section className="card stack" id="two-step">
          <h2>{t('twoStep')}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t('twoStepIntro')}
          </p>
          {me.mfaEnabled ? (
            <>
              <p style={{ margin: 0 }}>
                <span className="pill pill--delivered">{t('on')}</span>
              </p>
              <details>
                <summary>{t('turnItOff')}</summary>
                <form action={disableMfa} className="form" style={{ marginTop: 10 }}>
                  <label>
                    {t('disableCodeLabel')}
                    <input name="code" autoComplete="one-time-code" required maxLength={14} />
                  </label>
                  <div>
                    <button className="btn btn--secondary" type="submit">
                      {t('turnOffTwoStep')}
                    </button>
                  </div>
                </form>
              </details>
            </>
          ) : (
            <TwoStepSetup />
          )}
        </section>
      </div>

      <section className="card stack" id="passkeys" aria-labelledby="passkeys-title">
        <h2 id="passkeys-title">{t('passkeysTitle')}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t('passkeysIntro')}
        </p>
        {passkeys.length ? (
          <ul className="devices">
            {passkeys.map((passkey) => (
              <li key={passkey.id}>
                <div className="stack" style={{ gap: 2 }}>
                  <strong>
                    {passkey.name}{' '}
                    {passkey.synced ? (
                      <span className="pill pill--delivered" title={t('passkeySyncedHint')}>
                        {t('passkeySynced')}
                      </span>
                    ) : null}
                  </strong>
                  <span className="muted" style={{ fontSize: 14 }}>
                    {t('passkeyLine', {
                      added: f.date(passkey.createdAt),
                      used: passkey.lastUsedAt
                        ? t('passkeyLastUsed', { date: f.date(passkey.lastUsedAt) })
                        : t('passkeyNeverUsed'),
                    })}
                  </span>
                </div>
                <form action={removePasskey}>
                  <input type="hidden" name="id" value={passkey.id} />
                  <button
                    className="btn btn--secondary btn--sm"
                    type="submit"
                    aria-label={t('removePasskeyLabel', { name: passkey.name })}
                  >
                    {t('removePasskey')}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <p style={{ margin: 0 }}>{t('noPasskeys')}</p>
        )}
        <PasskeyAdd />
        {appSignIns.length ? (
          <div className="stack" style={{ gap: 8, marginTop: 8 }}>
            <h3 style={{ margin: 0 }}>{t('appSignInTitle')}</h3>
            <p className="muted" style={{ margin: 0, fontSize: 14 }}>
              {t('appSignInIntro')}
            </p>
            <ul className="devices">
              {appSignIns.map((device) => (
                <li key={device.id}>
                  <div className="stack" style={{ gap: 2 }}>
                    <strong>{device.deviceName}</strong>
                    <span className="muted" style={{ fontSize: 14 }}>
                      {t('appSignInLine', {
                        added: f.date(device.createdAt),
                        used: device.lastUsedAt
                          ? t('passkeyLastUsed', { date: f.date(device.lastUsedAt) })
                          : t('passkeyNeverUsed'),
                      })}
                    </span>
                  </div>
                  <form action={revokeDeviceSignIn}>
                    <input type="hidden" name="id" value={device.id} />
                    <button
                      className="btn btn--secondary btn--sm"
                      type="submit"
                      aria-label={t('appSignInOffLabel', { name: device.deviceName })}
                    >
                      {t('appSignInOff')}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="card stack" id="devices">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>{t('whereSignedIn')}</h2>
          {others ? (
            <form action={signOutOtherDevices}>
              <button className="btn btn--secondary btn--sm" type="submit">
                {t('signOutEverywhereElse')}
              </button>
            </form>
          ) : null}
        </div>
        <ul className="devices">
          {sessions.map((session) => (
            <li key={session.id}>
              <div className="stack" style={{ gap: 2 }}>
                <strong>
                  {deviceLabel(session, t)}{' '}
                  {session.current ? (
                    <span className="pill pill--delivered">{t('thisDevice')}</span>
                  ) : null}
                </strong>
                <span className="muted" style={{ fontSize: 14 }}>
                  {t('sessionLine', {
                    signedIn: f.date(session.createdAt),
                    lastActive: f.date(session.lastUsedAt),
                  })}
                  {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                </span>
              </div>
              {!session.current ? (
                <form action={signOutDevice}>
                  <input type="hidden" name="id" value={session.id} />
                  <button className="btn btn--secondary btn--sm" type="submit">
                    {tc('signOut')}
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="hint">{t('unrecognisedDevice')}</p>
      </section>
    </div>
  );
}
