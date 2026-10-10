import { type AdminUser, type CustomerNoteView, type GiftBalanceView } from '@nixzora/validation';

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
import { param, query, type SearchParams } from '@/lib/format';
import { isUuid } from '@/lib/forms';
import { getFormat, getLocale, getT } from '@/lib/i18n';
import { ROLE_KEYS, roleLabel } from '@/lib/roles';
import {
  addNote,
  grantGiftCredit,
  grantRole,
  resumeEmails,
  revokeRole,
  setStatus,
} from '../actions';

export async function generateMetadata(): Promise<Metadata> {
  const common = await getT('common');
  return { title: common('account') };
}

async function loadUser(id: string): Promise<AdminUser> {
  if (!isUuid(id)) notFound();
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
  const [orders, notes, gift] = await Promise.all([
    can(me, 'orders.read.all') ? load<CustomerOrder[]>(`/admin/users/${user.id}/orders`) : null,
    can(me, 'customers.notes') ? load<CustomerNoteView[]>(`/admin/users/${user.id}/notes`) : null,
    can(me, 'orders.read.all')
      ? load<GiftBalanceView>(`/admin/users/${user.id}/gift-balance`)
      : null,
  ]);
  const g = await getT('gifts');
  const [t, ops, common, f] = await Promise.all([
    getT('opsPeople'),
    getT('ops'),
    getT('common'),
    getFormat(),
  ]);
  const self = me.id === user.id;
  const missing = ROLE_KEYS.filter((key) => !user.roles.includes(key));
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const locale = await getLocale();
  const languageName = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  return (
    <>
      <PageHeader
        eyebrow={common('account')}
        title={user.email}
        actions={
          <Link className="btn btn--secondary" href="/users">
            {t('allUsers')}
          </Link>
        }
      />
      <Banner notice={param(search, 'notice')} error={param(search, 'error')} />

      <div className="two-col">
        <section className="card">
          <h2>{t('roles')}</h2>
          <p className="muted">{t('rolesIntro')}</p>
          <div className="table-wrap">
            <table>
              <tbody>
                {user.roles.map((key) => (
                  <tr key={key}>
                    <td>{roleLabel(ops, key)}</td>
                    <td className="num">
                      {can(me, 'roles.manage') && !(self && key === 'admin') ? (
                        <ActionButton
                          action={revokeRole}
                          label={common('remove')}
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
              <select name="roleKey" aria-label={t('roleToGrant')}>
                {missing.map((key) => (
                  <option key={key} value={key}>
                    {roleLabel(ops, key)}
                  </option>
                ))}
              </select>
              <SubmitButton>{t('grantRole')}</SubmitButton>
            </form>
          ) : null}
        </section>

        <section className="card">
          <h2>{common('account')}</h2>
          <dl>
            <dt className="muted">{t('name')}</dt>
            <dd>{name || '—'}</dd>
            <dt className="muted">{t('status')}</dt>
            <dd>
              <StatusPill value={user.status} />
            </dd>
            <dt className="muted">{t('emailVerified')}</dt>
            <dd>{user.emailVerified ? common('yes') : common('no')}</dd>
            <dt className="muted">{ops('twoStep')}</dt>
            <dd>{user.mfaEnabled ? ops('on') : ops('off')}</dd>
            <dt className="muted">{ops('signedInDevices')}</dt>
            <dd>{f.number(user.activeSessions)}</dd>
            <dt className="muted">{t('joined')}</dt>
            <dd>{f.dateTime(user.createdAt)}</dd>
            <dt className="muted">{t('mobilePhone')}</dt>
            <dd>{user.phone ? <a href={`tel:${user.phone}`}>{user.phone}</a> : '—'}</dd>
            <dt className="muted">{t('language')}</dt>
            <dd>{languageName(user.language)}</dd>
            <dt className="muted">{t('signInMethods')}</dt>
            <dd>
              {[
                ...(user.hasPassword ? [t('method_password')] : []),
                ...user.socialSignIns.map((provider) =>
                  provider === 'GOOGLE' || provider === 'APPLE'
                    ? t(`method_${provider}`)
                    : provider,
                ),
                ...(user.passkeys ? [t('passkeyCount', { count: user.passkeys })] : []),
              ].join(' · ') || '—'}
            </dd>
            <dt className="muted">{t('marketingEmails')}</dt>
            <dd>{user.marketingEmails ? t('subscribed') : t('notSubscribed')}</dd>
            <dt className="muted">{t('termsAccepted')}</dt>
            <dd>
              {user.termsAcceptedAt ? f.dateTime(user.termsAcceptedAt) : t('termsNotRecorded')}
            </dd>
            <dt className="muted">{t('emailDelivery')}</dt>
            <dd>
              {user.emailSuppressed ? (
                <>
                  <span className="pill pill--suspended">
                    {t(`emailStopped_${user.emailSuppressed.reason}`, {
                      date: f.dateTime(user.emailSuppressed.at),
                    })}
                  </span>
                  {user.emailSuppressed.detail ? (
                    <span className="muted"> {user.emailSuppressed.detail}</span>
                  ) : null}
                  {can(me, 'users.manage') ? (
                    <ActionButton
                      action={resumeEmails}
                      label={t('resumeEmails')}
                      tone="secondary"
                      fields={{ id: user.id }}
                    />
                  ) : null}
                </>
              ) : (
                t('emailDeliveryOk')
              )}
            </dd>
          </dl>
          {can(me, 'users.manage') && !self && user.status !== 'DELETED' ? (
            user.status === 'ACTIVE' ? (
              <ActionButton
                action={setStatus}
                label={t('suspendAccount')}
                tone="danger"
                fields={{ id: user.id, action: 'suspend' }}
              />
            ) : (
              <ActionButton
                action={setStatus}
                label={t('reactivateAccount')}
                fields={{ id: user.id, action: 'reactivate' }}
              />
            )
          ) : null}
          {can(me, 'audit.read') ? (
            <p>
              <Link href={`/audit${query({ actorId: user.id })}`}>{t('activityByAccount')}</Link>
            </p>
          ) : null}
        </section>
      </div>

      <div className="two-col">
        {orders ? (
          <section className="card">
            <h2>{t('orders')}</h2>
            {orders.length === 0 ? (
              <p className="muted">{t('noOrders')}</p>
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
                        <td>{f.dateTime(order.createdAt)}</td>
                        <td>
                          <StatusPill value={order.status} />
                        </td>
                        <td className="num">
                          {f.money(order.totalCents, order.currency)}
                          {order.refundedCents ? (
                            <div className="muted">
                              {t('refunded', {
                                amount: f.money(order.refundedCents, order.currency),
                              })}
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

        {gift ? (
          <section className="card">
            <h2>{g('creditTitle')}</h2>
            <p>{g('balance', { amount: f.money(gift.balanceCents) })}</p>
            {can(me, 'orders.refund') ? (
              <form action={grantGiftCredit} className="form">
                <input type="hidden" name="id" value={user.id} />
                <div className="form-row">
                  <label>
                    {g('creditAmount')}
                    <input name="amount" inputMode="decimal" required placeholder="15.00" />
                  </label>
                  <label>
                    {g('creditNote')}
                    <input name="note" required minLength={3} maxLength={200} />
                  </label>
                </div>
                <div>
                  <SubmitButton>{g('grant')}</SubmitButton>
                </div>
              </form>
            ) : null}
            {gift.entries.length ? (
              <ul className="activity">
                {gift.entries.slice(0, 10).map((entry) => (
                  <li key={entry.id}>
                    <span>
                      {g(`kind_${entry.kind}`, { number: entry.orderNumber ?? '' })}
                      {entry.note ? ` · ${entry.note}` : ''}
                    </span>
                    <span className="muted">
                      {entry.amountCents < 0 ? '−' : '+'}
                      {f.money(Math.abs(entry.amountCents))} · {f.dateTime(entry.createdAt)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ) : null}

        {notes ? (
          <section className="card">
            <h2>{t('supportNotes')}</h2>
            <p className="muted">{t('notesPrivate')}</p>
            <form action={addNote} className="form" style={{ marginBottom: 16 }}>
              <input type="hidden" name="id" value={user.id} />
              <textarea
                name="body"
                required
                minLength={2}
                maxLength={4000}
                rows={3}
                placeholder={t('notePlaceholder')}
                aria-label={t('newNote')}
              />
              <div>
                <SubmitButton>{t('addNote')}</SubmitButton>
              </div>
            </form>
            <ul className="activity">
              {notes.map((note) => (
                <li key={note.id} style={{ display: 'block' }}>
                  <div style={{ whiteSpace: 'pre-line' }}>{note.body}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {note.authorEmail} · {f.dateTime(note.createdAt)}
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
