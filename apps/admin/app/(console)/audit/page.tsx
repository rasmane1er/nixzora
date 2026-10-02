import { type Page } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, param, query, type SearchParams } from '@/lib/format';

export const metadata: Metadata = { title: 'Audit log' };

type Entry = {
  id: string;
  action: string;
  actorType: string;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const action = param(params, 'action');
  const rawActor = param(params, 'actorId');
  const actorId = rawActor && UUID.test(rawActor) ? rawActor : undefined;
  const cursor = param(params, 'cursor');
  const page = await load<Page<Entry>>(
    `/admin/audit-logs${query({ action, actorId, cursor, limit: 50 })}`,
  );

  return (
    <>
      <PageHeader eyebrow="Compliance" title="Audit log" />
      <p className="muted">
        Every sign-in, permission change and catalog edit, newest first. Entries cannot be edited or
        deleted.
      </p>

      <form className="toolbar" role="search">
        <label>
          Action
          <input name="action" defaultValue={action} placeholder="catalog.product.updated" />
        </label>
        <label>
          Actor id
          <input name="actorId" defaultValue={actorId} placeholder="User id" />
        </label>
        <button className="btn btn--secondary" type="submit">
          Filter
        </button>
        {action || actorId ? (
          <Link href="/audit" className="btn btn--secondary">
            Clear
          </Link>
        ) : null}
      </form>

      <section className="card">
        {page.items.length === 0 ? (
          <Empty>No entries match.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When (UTC)</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Entity</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dateTime(entry.createdAt)}</td>
                    <td>
                      <span className="mono">{entry.action}</span>
                      {entry.metadata && Object.keys(entry.metadata as object).length > 0 ? (
                        <details>
                          <summary className="muted">Details</summary>
                          <pre className="meta">{JSON.stringify(entry.metadata, null, 2)}</pre>
                        </details>
                      ) : null}
                    </td>
                    <td>
                      {entry.actorId ? (
                        <Link className="mono" href={`/users/${entry.actorId}`}>
                          {entry.actorId.slice(0, 8)}
                        </Link>
                      ) : (
                        <span className="muted">{entry.actorType.toLowerCase()}</span>
                      )}
                    </td>
                    <td className="mono">
                      {entry.entityType
                        ? `${entry.entityType}:${entry.entityId?.slice(0, 8) ?? ''}`
                        : '—'}
                    </td>
                    <td className="mono">{entry.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <nav className="pager" aria-label="Pages">
          {cursor ? <Link href={`/audit${query({ action, actorId })}`}>← Newest</Link> : <span />}
          {page.nextCursor ? (
            <Link href={`/audit${query({ action, actorId, cursor: page.nextCursor })}`}>
              Older →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </section>
    </>
  );
}
