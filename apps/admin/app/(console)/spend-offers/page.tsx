import { spendTiers } from '@nixzora/i18n';
import { SPEND_MAX_TIERS, type SpendOfferView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { createSpendOffer, endSpendOffer } from './actions';

const DAYS = [7, 14, 30, 90] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('spendSave');
  return { title: t('navTitle') };
}

/** Spend more, save more (p10-31): every store's tiers, and NIXZORA's own made here. */
export default async function SpendOffersPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [offers, t, people, f] = await Promise.all([
    load<SpendOfferView[]>('/admin/spend-offers'),
    getT('spendSave'),
    getT('opsPeople'),
    getFormat(),
  ]);
  const ownLive = offers.some((o) => !o.seller && o.status === 'ACTIVE');

  return (
    <>
      <PageHeader eyebrow={people('marketing')} title={t('navTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ maxWidth: '75ch' }}>
        {t('leadOps')}
      </p>

      <section className="card stack">
        <h2>{t('newOffer')}</h2>
        {ownLive ? (
          <p className="muted">{t('oneLive')}</p>
        ) : (
          <form action={createSpendOffer} className="form">
            <p className="hint">{t('tierHint')}</p>
            {Array.from({ length: SPEND_MAX_TIERS }, (_, i) => (
              <div className="form-row" key={i}>
                <label>
                  {t('tierLabel', { n: i + 1 })} · {t('spend')}
                  <input
                    name="minDollars"
                    inputMode="decimal"
                    required={i === 0}
                    pattern="\d{1,6}(\.\d{1,2})?"
                  />
                </label>
                <label>
                  {t('save')}
                  <input
                    name="offDollars"
                    inputMode="decimal"
                    required={i === 0}
                    pattern="\d{1,6}(\.\d{1,2})?"
                  />
                </label>
              </div>
            ))}
            <label>
              {t('runFor')}
              <select name="days" defaultValue="">
                <option value="">{t('untilEnded')}</option>
                {DAYS.map((n) => (
                  <option key={n} value={n}>
                    {t('days', { count: n })}
                  </option>
                ))}
              </select>
            </label>
            <SubmitButton>{t('create')}</SubmitButton>
          </form>
        )}
      </section>

      <section className="card">
        {offers.length === 0 ? (
          <Empty>{t('none')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('navTitle')}</th>
                  <th>{t('store')}</th>
                  <th>{t('runFor')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{spendTiers(t, o.tiers, (c) => f.money(c))}</strong>
                      <div className="muted small">
                        {t(`status_${o.status}`)} · {t('orders', { count: o.orders })}
                      </div>
                    </td>
                    <td>{o.seller?.displayName ?? t('nixzora')}</td>
                    <td>{o.endsAt ? t('endsOn', { date: f.date(o.endsAt) }) : t('noEnd')}</td>
                    <td>
                      {o.status === 'ACTIVE' ? (
                        <ActionButton
                          action={endSpendOffer}
                          label={t('end')}
                          fields={{ id: o.id }}
                        />
                      ) : null}
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
