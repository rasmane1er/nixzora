import { type AdminAdCampaignView, type AdSellerCredit, type AdStats } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { grantAdCredit, restoreCampaign, suspendCampaign } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ads');
  return { title: t('opsTitle') };
}

const FILTERS = ['ACTIVE', 'PAUSED', 'SUSPENDED'] as const;

/** Sponsored product campaigns (p10-01): review, stop, allow again; grant ad credit. */
export default async function AdsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const status = FILTERS.find((s) => s === param(params, 'status'));
  const [campaigns, sellers, t, people, f] = await Promise.all([
    load<AdminAdCampaignView[]>(`/admin/ads/campaigns${status ? `?status=${status}` : ''}`),
    load<AdSellerCredit[]>('/admin/ads/sellers'),
    getT('ads'),
    getT('opsPeople'),
    getFormat(),
  ]);
  const stats = (s: AdStats) =>
    t('statsLine', {
      impressions: f.number(s.impressions),
      clicks: f.number(s.clicks),
      spend: f.money(s.spendCents),
    });

  return (
    <>
      <PageHeader eyebrow={people('marketing')} title={t('opsTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ maxWidth: '75ch' }}>
        {t('opsLead')}
      </p>
      <nav className="toolbar" aria-label={t('colStatus')}>
        <Link href="/ads" aria-current={!status ? 'page' : undefined}>
          {t('filterAll')}
        </Link>
        {FILTERS.map((s) => (
          <Link key={s} href={`/ads?status=${s}`} aria-current={status === s ? 'page' : undefined}>
            {t(`status_${s}`)}
          </Link>
        ))}
      </nav>

      <div className="two-col">
        <section className="card">
          {campaigns.length === 0 ? (
            <Empty>{t('noOpsCampaigns')}</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('colCampaign')}</th>
                    <th>{t('colSeller')}</th>
                    <th>{t('colBudget')}</th>
                    <th>{t('colToday')}</th>
                    <th>{t('col30')}</th>
                    <th>{t('colStatus')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <strong>{c.name}</strong>
                        <div className="muted">{c.products.map((p) => p.title).join(', ')}</div>
                      </td>
                      <td>
                        <Link href={`/sellers/${c.seller.id}`}>{c.seller.displayName}</Link>
                      </td>
                      <td className="muted">
                        {t('budgetPerDay', { amount: f.money(c.dailyBudgetCents) })}
                        <br />
                        {t('bidUpTo', { amount: f.money(c.bidCents) })}
                      </td>
                      <td className="muted">{stats(c.today)}</td>
                      <td className="muted">{stats(c.last30Days)}</td>
                      <td>
                        <span className={`pill pill--${c.status.toLowerCase()}`}>
                          {c.ended ? t('ended') : t(`status_${c.status}`)}
                        </span>
                        {c.suspendedReason ? (
                          <div className="muted">{c.suspendedReason}</div>
                        ) : null}
                      </td>
                      <td>
                        {c.status === 'SUSPENDED' ? (
                          <ActionButton
                            action={restoreCampaign}
                            label={t('restore')}
                            fields={{ id: c.id }}
                          />
                        ) : (
                          <form action={suspendCampaign} className="inline-form">
                            <input type="hidden" name="id" value={c.id} />
                            <label className="sr-only" htmlFor={`reason-${c.id}`}>
                              {t('suspendReason')}
                            </label>
                            <input
                              id={`reason-${c.id}`}
                              name="reason"
                              required
                              minLength={3}
                              maxLength={300}
                              placeholder={t('suspendReason')}
                            />
                            <SubmitButton tone="danger">{t('suspend')}</SubmitButton>
                          </form>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2>{t('grantCredit')}</h2>
          <p className="muted">{t('grantCreditHint')}</p>
          <form action={grantAdCredit} className="form">
            <label>
              {t('sellerLabel')}
              <select name="sellerId" required>
                {sellers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.displayName} ({f.money(s.creditCents)})
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('amount')}
              <input name="amount" inputMode="decimal" required placeholder="50.00" />
            </label>
            <label>
              {t('note')}
              <input name="note" required minLength={3} maxLength={200} />
            </label>
            <div>
              <SubmitButton>{t('grant')}</SubmitButton>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
