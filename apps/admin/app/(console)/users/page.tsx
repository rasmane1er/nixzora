import { type AdminUser, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader, Pager, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { param, query, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { ROLE_KEYS, roleLabel } from '@/lib/roles';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsPeople');
  return { title: t('usersTitle') };
}

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const role = param(params, 'role');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const result = await load<PagedResult<AdminUser>>(
    `/admin/users${query({ q, role, page, pageSize: 25 })}`,
  );
  const [t, ops, common, f] = await Promise.all([
    getT('opsPeople'),
    getT('ops'),
    getT('common'),
    getFormat(),
  ]);

  return (
    <>
      <PageHeader eyebrow={t('people')} title={t('usersTitle')} />

      <form className="toolbar" role="search">
        <label>
          {common('search')}
          <input type="search" name="q" defaultValue={q} placeholder={t('searchPlaceholder')} />
        </label>
        <label>
          {t('role')}
          <select name="role" defaultValue={role ?? ''}>
            <option value="">{t('anyRole')}</option>
            {ROLE_KEYS.map((key) => (
              <option key={key} value={key}>
                {roleLabel(ops, key)}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--secondary" type="submit">
          {t('filter')}
        </button>
      </form>

      <section className="card">
        {result.items.length === 0 ? (
          <Empty>{t('noAccounts')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colAccount')}</th>
                  <th>{t('colRoles')}</th>
                  <th>{t('colStatus')}</th>
                  <th>{t('colTwoStep')}</th>
                  <th>{t('colJoined')}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <Link href={`/users/${user.id}`}>{user.email}</Link>
                      <div className="muted">
                        {[user.firstName, user.lastName].filter(Boolean).join(' ') || '—'}
                      </div>
                    </td>
                    <td>{user.roles.map((key) => roleLabel(ops, key)).join(', ') || '—'}</td>
                    <td>
                      <StatusPill value={user.status} />
                    </td>
                    <td>{user.mfaEnabled ? ops('on') : ops('off')}</td>
                    <td>{f.dateTime(user.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={result.page}
          totalPages={result.totalPages}
          href={(n) => `/users${query({ q, role, page: n })}`}
        />
      </section>
      <p className="muted">{t('accountsCount', { count: result.total })}</p>
    </>
  );
}
