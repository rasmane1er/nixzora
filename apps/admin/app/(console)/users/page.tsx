import { type AdminUser, type PagedResult } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Empty, PageHeader, Pager, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { dateTime, param, query, type SearchParams } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/roles';

export const metadata: Metadata = { title: 'Users & roles' };

export default async function UsersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const role = param(params, 'role');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const result = await load<PagedResult<AdminUser>>(
    `/admin/users${query({ q, role, page, pageSize: 25 })}`,
  );

  return (
    <>
      <PageHeader eyebrow="People" title="Users & roles" />

      <form className="toolbar" role="search">
        <label>
          Search
          <input type="search" name="q" defaultValue={q} placeholder="Email or name" />
        </label>
        <label>
          Role
          <select name="role" defaultValue={role ?? ''}>
            <option value="">Any</option>
            {Object.entries(ROLE_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn--secondary" type="submit">
          Filter
        </button>
      </form>

      <section className="card">
        {result.items.length === 0 ? (
          <Empty>No accounts match.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Roles</th>
                  <th>Status</th>
                  <th>2-step</th>
                  <th>Joined</th>
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
                    <td>{user.roles.map((key) => ROLE_LABELS[key] ?? key).join(', ') || '—'}</td>
                    <td>
                      <StatusPill value={user.status} />
                    </td>
                    <td>{user.mfaEnabled ? 'On' : 'Off'}</td>
                    <td>{dateTime(user.createdAt)}</td>
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
      <p className="muted">{result.total} accounts</p>
    </>
  );
}
