import { type AccountProfile, type MeResponse, type SessionSummary } from '@nixzora/validation';
import type { Metadata } from 'next';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi, day } from '@/lib/account';
import { param, type SearchParams } from '@/lib/params';
import {
  changePassword,
  disableMfa,
  resendVerification,
  signOutDevice,
  signOutOtherDevices,
  updateProfile,
} from '../hub-actions';
import { TwoStepSetup } from './TwoStep';

export const metadata: Metadata = { title: 'Login & security', robots: { index: false } };

/** "Chrome on macOS" from a user agent, for the device list. */
function deviceLabel(session: SessionSummary): string {
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
  if (browser && os) return `${browser} on ${os}`;
  return session.deviceName ?? 'Unknown device';
}

export default async function SecurityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [profile, me, sessions] = await Promise.all([
    accountApi<AccountProfile>('/me/profile', '/account/security'),
    accountApi<MeResponse>('/auth/me', '/account/security'),
    accountApi<SessionSummary[]>('/me/sessions', '/account/security'),
  ]);
  const others = sessions.filter((s) => !s.current).length;

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title="Login & security"
        description="Your name, how you sign in, and where you are signed in."
      />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <div className="account-grid">
        <section className="card stack">
          <h2>Name and phone</h2>
          <form action={updateProfile} className="form">
            <div className="form-row">
              <label>
                First name
                <input
                  name="firstName"
                  defaultValue={profile.firstName ?? ''}
                  maxLength={60}
                  autoComplete="given-name"
                />
              </label>
              <label>
                Last name
                <input
                  name="lastName"
                  defaultValue={profile.lastName ?? ''}
                  maxLength={60}
                  autoComplete="family-name"
                />
              </label>
            </div>
            <label>
              Mobile number <span className="hint">For delivery questions only.</span>
              <input
                name="phone"
                type="tel"
                defaultValue={profile.phone ?? ''}
                maxLength={20}
                autoComplete="tel"
              />
            </label>
            <div>
              <button className="btn btn--primary" type="submit">
                Save
              </button>
            </div>
          </form>
        </section>

        <section className="card stack">
          <h2>Email</h2>
          <p style={{ margin: 0 }}>
            <strong>{profile.email}</strong>{' '}
            {profile.emailVerified ? (
              <span className="pill pill--delivered">Confirmed</span>
            ) : (
              <span className="pill pill--pending_payment">Not confirmed</span>
            )}
          </p>
          {!profile.emailVerified ? (
            <form action={resendVerification}>
              <button className="btn btn--secondary btn--sm" type="submit">
                Send the confirmation link again
              </button>
            </form>
          ) : null}
          <p className="muted" style={{ fontSize: 14, margin: 0 }}>
            Order confirmations and receipts go here. To use another address, contact support.
          </p>
          {me.linkedProviders.length ? (
            <p className="muted" style={{ fontSize: 14, margin: 0 }}>
              You can also sign in with{' '}
              {me.linkedProviders.map((p) => (p === 'google' ? 'Google' : 'Apple')).join(' and ')}.
            </p>
          ) : null}
        </section>

        <section className="card stack" id="password">
          <h2>Password</h2>
          {me.hasPassword ? (
            <form action={changePassword} className="form">
              <label>
                Current password
                <input
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </label>
              <label>
                New password <span className="hint">At least 12 characters.</span>
                <input
                  name="newPassword"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </label>
              <label>
                New password again
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
                  Change password
                </button>
              </div>
              <p className="hint">Changing it signs you out on your other devices.</p>
            </form>
          ) : (
            <p className="muted" style={{ margin: 0 }}>
              You sign in with {me.linkedProviders.includes('apple') ? 'Apple' : 'Google'}, so this
              account has no NIXZORA password. To add one, use{' '}
              <a href="/account/forgot-password">Forgot password</a> with your email.
            </p>
          )}
        </section>

        <section className="card stack" id="two-step">
          <h2>Two-step verification</h2>
          <p className="muted" style={{ margin: 0 }}>
            A code from your phone at sign-in, so a stolen password is not enough to get in.
          </p>
          {me.mfaEnabled ? (
            <>
              <p style={{ margin: 0 }}>
                <span className="pill pill--delivered">On</span>
              </p>
              <details>
                <summary>Turn it off</summary>
                <form action={disableMfa} className="form" style={{ marginTop: 10 }}>
                  <label>
                    Code from your app, or a recovery code
                    <input name="code" autoComplete="one-time-code" required maxLength={14} />
                  </label>
                  <div>
                    <button className="btn btn--secondary" type="submit">
                      Turn off two-step verification
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

      <section className="card stack" id="devices">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2>Where you are signed in</h2>
          {others ? (
            <form action={signOutOtherDevices}>
              <button className="btn btn--secondary btn--sm" type="submit">
                Sign out everywhere else
              </button>
            </form>
          ) : null}
        </div>
        <ul className="devices">
          {sessions.map((session) => (
            <li key={session.id}>
              <div className="stack" style={{ gap: 2 }}>
                <strong>
                  {deviceLabel(session)}{' '}
                  {session.current ? (
                    <span className="pill pill--delivered">This device</span>
                  ) : null}
                </strong>
                <span className="muted" style={{ fontSize: 14 }}>
                  Signed in {day(session.createdAt)} · last active {day(session.lastUsedAt)}
                  {session.ipAddress ? ` · ${session.ipAddress}` : ''}
                </span>
              </div>
              {!session.current ? (
                <form action={signOutDevice}>
                  <input type="hidden" name="id" value={session.id} />
                  <button className="btn btn--secondary btn--sm" type="submit">
                    Sign out
                  </button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <p className="hint">Don&apos;t recognise a device? Sign it out and change your password.</p>
      </section>
    </div>
  );
}
