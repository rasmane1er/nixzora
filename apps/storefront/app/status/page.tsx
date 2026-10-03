import type { Metadata } from 'next';
import { getApiHealth } from '@/lib/api';
import { getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('errors');
  return { title: t('statusTitle'), robots: { index: false } };
}
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const [result, t] = await Promise.all([getApiHealth(), getT('errors')]);
  const healthy = result.reachable && result.health.status === 'ok';
  const row = (name: string, check: { status: string; latencyMs?: number } | undefined) => (
    <tr key={name}>
      <td>{name}</td>
      <td>
        {check?.status === 'up'
          ? t('checkUp', { latency: check.latencyMs ?? '?' })
          : t('checkDown')}
      </td>
    </tr>
  );
  return (
    <div className="wrap section">
      <section className="card auth stack" style={{ maxWidth: 560 }}>
        <h1>{t('statusTitle')}</h1>
        <p className={`banner ${healthy ? 'banner--ok' : 'banner--error'}`}>
          {healthy
            ? t('statusOk')
            : result.reachable
              ? t('statusDegraded')
              : t('statusUnreachable')}
        </p>
        {result.reachable ? (
          <div className="table-scroll">
            <table className="plain">
              <tbody>
                <tr>
                  <td>{t('apiVersion')}</td>
                  <td>{result.health.version}</td>
                </tr>
                {row('PostgreSQL', result.health.checks.database)}
                {row('Redis', result.health.checks.redis)}
                {result.health.jobs ? (
                  <tr>
                    <td>{t('jobs')}</td>
                    <td>
                      {result.health.jobs.status === 'up'
                        ? result.health.jobs.backlog
                          ? t('jobsSending', { backlog: result.health.jobs.backlog })
                          : t('jobsUpToDate')
                        : result.health.jobs.status === 'down'
                          ? t('jobsDelayed')
                          : t('jobsStarting')}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">{result.error}</p>
        )}
      </section>
    </div>
  );
}
