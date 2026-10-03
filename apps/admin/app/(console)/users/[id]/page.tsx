import { type AdminUser, type CustomerNoteView } from '@nixzora/validation';

type CustomerOrder = {
  id: string;
  number: string;
  status: string;
  totalCents: number;
  refundedCents: number;
  currency: string;
  createdAt: string;
};
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, PageHeader, StatusPill } from '@/components/ui';
import { ApiError, load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { dateTime, money, param, query, type SearchParams } from '@/lib/format';
import { ROLE_LABELS } from '@/lib/roles';
import { addNote, grantRole, revokeRole, setStatus } from '../actions';

export const metadata: Metadata = { title: 'Account' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadUser(id: string): Promise<AdminUser> {
  if (!UUID.test(id)) notFound();
  try {
    return await load<AdminUser>(`/admin/users/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const search = await searchParams;
  const [me, user] = await Promise.all([currentStaff(), loadUser(id)]);
  const [orders, notes] = await Promise.all([
    can(me, 'orders.read.all') ? load<CustomerOrder[]>(`/admin/users/${user.id}/orders`) : null,
    can(me, 'customers.notes') ? load<CustomerNoteView[]>(`/admin/users/${user.id}/notes`) : null,
  ]);
  const self = me.id === user.id;
  const missing = Object.keys(ROLE_LABELS).filter((key) => !user.roles.includes(key));
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');

  return (
    <>
      <PageHeader
        eyebrow="Account"
        title={user.email}
        actions={
          <Link className="btn btn--secondary" href="/users">
            All users
          </Link>
        }
      />
      <Banner notice={param(search, 'notice')} error={param(search, 'error')} />

      <div className="two-col">
        <section className="card">
          <h2>Roles</h2>
          <p className="muted">
            Staff roles unlock the Ops Center. Every change is recorded in the audit log.
          </p>
          <div className="table-wrap">
            <table>
              <tbody>
                {user.roles.map((key) => (
                  <tr key={key}>
                    <td>{ROLE_LABELS[key] ?? key}</td>
                    <td className="num">
                      {can(me, 'roles.manage') && !(self && key === 'admin') ? (
                        <ActionButton
                          action={revokeRole}
                          label="Remove"
                          tone="danger"
                          fields={{ id: user.id, roleKey: key }}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {can(me, 'roles.manage') && missing.length > 0 ? (
            <form action={grantRole} className="inline-form" style={{ marginTop: 16 }}>
              <input type="hidden" name="id" value={user.id} />
              <select name="roleKey" aria-label="Role to grant">
                {missing.map((key) => (
                  <option key={key} value={key}>
                    {ROLE_LABELS[key]}
                  </option>
                ))}
              </select>
              <SubmitButton>Grant role</SubmitButton>
            </form>
          ) : null}
        </section>

        <section className="card">
          <h2>Account</h2>
          <dl>
            <dt className="muted">Name</dt>
            <dd>{name || '—'}</dd>
            <dt className="muted">Status</dt>
            <dd>
              <StatusPill value={user.status} />
            </dd>
            <dt className="muted">Email verified</dt>
            <dd>{user.emailVerified ? 'Yes' : 'No'}</dd>
            <dt className="muted">Two-step verification</dt>
            <dd>{user.mfaEnabled ? 'On' : 'Off'}</dd>
            <dt className="muted">Signed-in devices</dt>
            <dd>{user.activeSessions}</dd>
            <dt className="muted">Joined</dt>
            <dd>{dateTime(user.createdAt)}</dd>
          </dl>
          {can(me, 'users.manage') && !self && user.status !== 'DELETED' ? (
            user.status === 'ACTIVE' ? (
              <ActionButton
                action={setStatus}
                label="Suspend account"
                tone="danger"
                fields={{ id: user.id, action: 'suspend' }}
              />
            ) : (
              <ActionButton
                action={setStatus}
                label="Reactivate account"
                fields={{ id: user.id, action: 'reactivate' }}
              />
            )
          ) : null}
          {can(me, 'audit.read') ? (
            <p>
              <Link href={`/audit${query({ actorId: user.id })}`}>Activity by this account →</Link>
            </p>
          ) : null}
        </section>
      </div>

      <div className="two-col">
        {orders ? (
          <section className="card">
            <h2>Orders</h2>
            {orders.length === 0 ? (
              <p className="muted">No orders yet.</p>
            ) : (
              <div className="table-wrap">
                <table>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <Link className="mono" href={`/orders/${order.id}`}>
                            {order.number}
                          </Link>
                        </td>
                        <td>{dateTime(order.createdAt)}</td>
                        <td>
                          <StatusPill value={order.status} />
                        </td>
                        <td className="num">
                          {money(order.totalCents, order.currency)}
                          {order.refundedCents ? (
                            <div className="muted">
                              −{money(order.refundedCents, order.currency)} refunded
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : null}

        {notes ? (
          <section className="card">
            <h2>Support notes</h2>
            <p className="muted">Private to staff. Never shown to the customer.</p>
            <form action={addNote} className="form" style={{ marginBottom: 16 }}>
              <input type="hidden" name="id" value={user.id} />
              <textarea
                name="body"
                required
                minLength={2}
                maxLength={4000}
                rows={3}
                placeholder="What happened, what you did"
                aria-label="New note"
              />
              <div>
                <SubmitButton>Add note</SubmitButton>
              </div>
            </form>
            <ul className="activity">
              {notes.map((note) => (
                <li key={note.id} style={{ display: 'block' }}>
                  <div style={{ whiteSpace: 'pre-line' }}>{note.body}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {note.authorEmail} · {dateTime(note.createdAt)}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </>
  );
}
