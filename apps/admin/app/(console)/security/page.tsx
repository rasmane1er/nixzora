import { type SessionSummary } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionButton, Banner, PageHeader, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { currentStaff } from '@/lib/auth';
import { rich } from '@nixzora/i18n';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { revokeOthers, revokeSession } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return { title: t('nav_security') };
}

export default async function SecurityPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [me, sessions] = await Promise.all([
    currentStaff(),
    load<SessionSummary[]>('/me/sessions'),
  ]);
  const [t, common, f] = await Promise.all([getT('ops'), getT('common'), getFormat()]);

  return (
    <>
      <PageHeader eyebrow={common('account')} title={t('nav_security')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <section className="card">
        <h2>{t('twoStep')}</h2>
        {me.mfaEnabled ? (
          <p>
            <StatusPill value="active" /> {t('mfaOn')}
          </p>
        ) : (
          <p>
            <StatusPill value="draft" />{' '}
            {rich(t('mfaOff'), {
              link: (chunk) => (
                <Link key="setup" href="/security/setup">
                  {chunk}
                </Link>
              ),
            })}
          </p>
        )}
      </section>

      <section className="card">
        <div className="page-header">
          <h2>{t('signedInDevices')}</h2>
          {sessions.length > 1 ? (
            <ActionButton action={revokeOthers} label={t('signOutOthers')} tone="danger" />
          ) : null}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>{t('colDevice')}</th>
                <th>{t('colIp')}</th>
                <th>{t('colLastUsed')}</th>
                <th>{t('colVerified')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sessions.map((session) => (
                <tr key={session.id}>
                  <td>
                    {session.deviceName ?? t('unknownDevice')}
                    {session.current ? <span className="muted"> · {t('thisBrowser')}</span> : null}
                  </td>
                  <td className="mono">{session.ipAddress ?? '—'}</td>
                  <td>{f.dateTime(session.lastUsedAt)}</td>
                  <td>{session.mfaVerified ? common('yes') : common('no')}</td>
                  <td className="num">
                    {session.current ? null : (
                      <ActionButton
                        action={revokeSession}
                        label={common('signOut')}
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
