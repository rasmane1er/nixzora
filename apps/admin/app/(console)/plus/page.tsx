import { type AdminPlusOverview, type PlusStatus } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { endMembership } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('plus');
  return { title: t('opsTitle') };
}

const STATUSES: PlusStatus[] = ['TRIALING', 'ACTIVE', 'PAST_DUE', 'ENDED'];

/** NIXZORA Plus members and recurring revenue (p10-15). */
export default async function PlusPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = STATUSES.find((s) => s === param(params, 'status'));
  const q = param(params, 'q') ?? '';
  const query = new URLSearchParams({ ...(status ? { status } : {}), ...(q ? { q } : {}) });
  const [overview, t, people, f] = await Promise.all([
    load<AdminPlusOverview>(`/admin/plus?${query.toString()}`),
    getT('plus'),
    getT('opsPeople'),
    getFormat(),
  ]);
  return (
    <>
      <PageHeader eyebrow={people('customers')} title={t('opsTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ maxWidth: '75ch' }}>
        {t('opsLead')}
      </p>
      <section className="grid" aria-label={t('opsTitle')}>
        {STATUSES.map((s) => (
          <div key={s} className="stat">
            <div className="stat__label">{t(`status_${s}`)}</div>
            <div className="stat__value">{f.number(overview.counts[s])}</div>
          </div>
        ))}
        <div className="stat">
          <div className="stat__label">{t('mrr')}</div>
          <div className="stat__value">{f.money(overview.mrrCents)}</div>
        </div>
        <div className="stat">
          <div className="stat__label">{t('leaving')}</div>
          <div className="stat__value">{f.number(overview.leaving)}</div>
        </div>
      </section>
      <form className="inline-form" action="/plus">
        <select name="status" defaultValue={status ?? ''} aria-label={t('colStatus')}>
          <option value="">{t('allStatuses')}</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {t(`status_${s}`)}
            </option>
          ))}
        </select>
        <input name="q" defaultValue={q} aria-label={t('search')} placeholder={t('search')} />
        <SubmitButton tone="secondary">{t('filter')}</SubmitButton>
      </form>
      <section className="card">
        {overview.members.length === 0 ? (
          <Empty>{t('none')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colMember')}</th>
                  <th>{t('colPlan')}</th>
                  <th>{t('colStatus')}</th>
                  <th>{t('colUntil')}</th>
                  <th>{t('colFailures')}</th>
                  <th>{t('colSince')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {overview.members.map((m) => (
                  <tr key={m.userId}>
                    <td>
                      <Link href={`/users/${m.userId}`}>{m.name || m.email}</Link>
                      <div className="muted small">{m.email}</div>
                    </td>
                    <td>{t(`plan_${m.plan}`)}</td>
                    <td>
                      {t(`status_${m.status}`)}
                      {m.cancelAtPeriodEnd && m.status !== 'ENDED' ? ` · ${t('leaving')}` : ''}
                    </td>
                    <td>{f.date(m.currentPeriodEnd)}</td>
                    <td>{m.failedAttempts}</td>
                    <td>{f.date(m.startedAt)}</td>
                    <td>
                      {m.status === 'ENDED' ? null : (
                        <ActionButton
                          action={endMembership}
                          label={t('endNow')}
                          tone="danger"
                          fields={{ userId: m.userId }}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
