import type { Metadata } from 'next';
import { getApiHealth } from '@/lib/api';

export const metadata: Metadata = { title: 'Platform status', robots: { index: false } };
export const dynamic = 'force-dynamic';

export default async function StatusPage() {
  const result = await getApiHealth();
  const healthy = result.reachable && result.health.status === 'ok';
  const row = (name: string, check: { status: string; latencyMs?: number } | undefined) => (
    <tr key={name}>
      <td>{name}</td>
      <td>{check?.status === 'up' ? `Up · ${check.latencyMs ?? '?'} ms` : 'Down'}</td>
    </tr>
  );
  return (
    <div className="wrap section">
      <section className="card auth stack" style={{ maxWidth: 560 }}>
        <h1>Platform status</h1>
        <p className={`banner ${healthy ? 'banner--ok' : 'banner--error'}`}>
          {healthy ? 'All systems normal' : result.reachable ? 'Degraded' : 'API unreachable'}
        </p>
        {result.reachable ? (
          <div className="table-scroll">
            <table className="plain">
              <tbody>
                <tr>
                  <td>API version</td>
                  <td>{result.health.version}</td>
                </tr>
                {row('PostgreSQL', result.health.checks.database)}
                {row('Redis', result.health.checks.redis)}
                {result.health.jobs ? (
                  <tr>
                    <td>Emails and notifications</td>
                    <td>
                      {result.health.jobs.status === 'up'
                        ? result.health.jobs.backlog
                          ? `Sending · ${result.health.jobs.backlog} waiting`
                          : 'Up to date'
                        : result.health.jobs.status === 'down'
                          ? 'Delayed'
                          : 'Starting'}
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
