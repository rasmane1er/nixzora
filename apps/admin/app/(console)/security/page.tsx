import { type SessionSummary } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionButton, Banner, PageHeader, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { currentStaff } from '@/lib/auth';
import { dateTime, param, type SearchParams } from '@/lib/format';
import { revokeOthers, revokeSession } from './actions';

export const metadata: Metadata = { title: 'My security' };

export default async function SecurityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [me, sessions] = await Promise.all([
    currentStaff(),
    load<SessionSummary[]>('/me/sessions'),
  ]);

  return (
    <>
      <PageHeader eyebrow="Account" title="My security" />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <section className="card">
        <h2>Two-step verification</h2>
        {me.mfaEnabled ? (
          <p>
            <StatusPill value="active" /> On. Every Ops Center sign-in asks for a code from your
            authenticator app.
          </p>
        ) : (
          <p>
            <StatusPill value="draft" /> Off. Staff tools stay locked until you{' '}
            <Link href="/security/setup">turn it on</Link>.
          </p>
        )}
      </section>

      <section className="card">
        <div className="page-header">
          <h2>Signed-in devices</h2>
          {sessions.length > 1 ? (
            <ActionButton action={revokeOthers} label="Sign out all other devices" tone="danger" />
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Device</th>
                <th>IP</th>
                <th>Last used</th>
                <th>Verified</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    {session.deviceName ?? 'Unknown device'}
                    {session.current ? <span className="muted"> · this browser</span> : null}
                  </td>
                  <td className="mono">{session.ipAddress ?? '—'}</td>
                  <td>{dateTime(session.lastUsedAt)}</td>
                  <td>{session.mfaVerified ? 'Yes' : 'No'}</td>
                  <td className="num">
                    {session.current ? null : (
                      <ActionButton
                        action={revokeSession}
                        label="Sign out"
                        fields={{ id: session.id }}
                      />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
