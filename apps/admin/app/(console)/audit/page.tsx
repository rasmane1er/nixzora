import { type Page } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { type MessageKey } from '@nixzora/i18n';
import { dateTime, param, query, type SearchParams } from '@/lib/format';
import { isUuid } from '@/lib/forms';
import { getLocale, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return { title: t('nav_audit') };
}

const ACTORS = new Set(['user', 'admin', 'system']);

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

export default async function AuditPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const action = param(params, 'action');
  const rawActor = param(params, 'actorId');
  const actorId = rawActor && isUuid(rawActor) ? rawActor : undefined;
  const cursor = param(params, 'cursor');
  const page = await load<Page<Entry>>(
    `/admin/audit-logs${query({ action, actorId, cursor, limit: 50 })}`,
  );
  const [t, ops, locale] = await Promise.all([getT('opsPeople'), getT('ops'), getLocale()]);
  const actorLabel = (type: string) => {
    const code = type.toLowerCase();
    return ACTORS.has(code) ? t(`actor_${code}` as MessageKey<'opsPeople'>) : code;
  };

  return (
    <>
      <PageHeader eyebrow={t('compliance')} title={ops('nav_audit')} />
      <p className="muted">{t('auditIntro')}</p>

      <form className="toolbar" role="search">
        <label>
          {t('action')}
          <input name="action" defaultValue={action} placeholder="catalog.product.updated" />
        </label>
        <label>
          {t('actorId')}
          <input name="actorId" defaultValue={actorId} placeholder={t('userIdPlaceholder')} />
        </label>
        <button className="btn btn--secondary" type="submit">
          {t('filter')}
        </button>
        {action || actorId ? (
          <Link href="/audit" className="btn btn--secondary">
            {t('clear')}
          </Link>
        ) : null}
      </form>

      <section className="card">
        {page.items.length === 0 ? (
          <Empty>{t('noEntries')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colWhenUtc')}</th>
                  <th>{t('colAction')}</th>
                  <th>{t('colActor')}</th>
                  <th>{t('colEntity')}</th>
                  <th>{t('colIp')}</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{dateTime(entry.createdAt, locale)}</td>
                    <td>
                      <span className="mono">{entry.action}</span>
                      {entry.metadata && Object.keys(entry.metadata as object).length > 0 ? (
                        <details>
                          <summary className="muted">{t('details')}</summary>
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
                        <span className="muted">{actorLabel(entry.actorType)}</span>
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
        <nav className="pager" aria-label={ops('pages')}>
          {cursor ? (
            <Link href={`/audit${query({ action, actorId })}`}>{t('newest')}</Link>
          ) : (
            <span />
          )}
          {page.nextCursor ? (
            <Link href={`/audit${query({ action, actorId, cursor: page.nextCursor })}`}>
              {t('older')}
            </Link>
          ) : (
            <span />
          )}
        </nav>
      </section>
    </>
  );
}
