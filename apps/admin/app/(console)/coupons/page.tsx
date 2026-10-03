import { type CouponView } from '@nixzora/validation';
import type { Metadata } from 'next';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { createCoupon, setCouponActive, setCouponPublic } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('ops');
  return { title: t('nav_coupons') };
}

const day = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

export default async function CouponsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const coupons = await load<CouponView[]>('/admin/coupons');
  const [t, ops, f] = await Promise.all([getT('opsPeople'), getT('ops'), getFormat()]);

  return (
    <>
      <PageHeader eyebrow={t('marketing')} title={ops('nav_coupons')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <div className="two-col">
        <section className="card">
          {coupons.length === 0 ? (
            <Empty>{t('noCoupons')}</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{t('colCode')}</th>
                    <th>{t('colDiscount')}</th>
                    <th>{t('colRules')}</th>
                    <th className="num">{t('colUsed')}</th>
                    <th>{t('colStatus')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id}>
                      <td>
                        <span className="mono">{c.code}</span>
                        {c.description ? <div className="muted">{c.description}</div> : null}
                      </td>
                      <td>
                        {c.type === 'PERCENT'
                          ? t('percentOff', { value: f.percent(c.value / 10000) })
                          : t('amountOff', { amount: f.money(c.value) })}
                      </td>
                      <td className="muted">
                        {c.minSubtotalCents
                          ? t('minSpend', { amount: f.money(c.minSubtotalCents) })
                          : t('noMinimum')}
                        <br />
                        {day(c.startsAt)} → {day(c.endsAt)}
                      </td>
                      <td className="num">
                        {c.redemptionCount}
                        {c.maxRedemptions ? ` / ${c.maxRedemptions}` : ''}
                      </td>
                      <td>
                        <StatusPill value={c.isActive ? 'active' : 'archived'} />
                        {c.isPublic ? <div className="muted">{t('listedInAccounts')}</div> : null}
                      </td>
                      <td className="num">
                        <ActionButton
                          action={setCouponActive}
                          label={c.isActive ? t('turnOff') : t('turnOn')}
                          fields={{ id: c.id, isActive: String(!c.isActive) }}
                        />{' '}
                        <ActionButton
                          action={setCouponPublic}
                          label={c.isPublic ? t('hideFromAccounts') : t('listInAccounts')}
                          fields={{ id: c.id, isPublic: String(!c.isPublic) }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="card">
          <h2>{t('newCoupon')}</h2>
          <form action={createCoupon} className="form">
            <label>
              {t('code')} <span className="hint">{t('codeHint')}</span>
              <input
                name="code"
                required
                pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,31}"
                style={{ textTransform: 'uppercase' }}
                placeholder="WELCOME10"
              />
            </label>
            <label>
              {t('description')} <span className="hint">{t('descriptionHint')}</span>
              <input name="description" maxLength={200} placeholder={t('descriptionPlaceholder')} />
            </label>
            <div className="form-row">
              <label>
                {t('type')}
                <select name="type" defaultValue="PERCENT">
                  <option value="PERCENT">{t('typePercent')}</option>
                  <option value="FIXED">{t('typeFixed')}</option>
                </select>
              </label>
              <label>
                {t('percent')}
                <input name="percent" inputMode="decimal" placeholder="10" />
              </label>
              <label>
                {t('amount')}
                <input name="amount" inputMode="decimal" placeholder="15.00" />
              </label>
            </div>
            <div className="form-row">
              <label>
                {t('minimumSpend')}
                <input name="minSubtotal" inputMode="decimal" placeholder="0" />
              </label>
              <label>
                {t('maxUses')}
                <input name="maxRedemptions" type="number" min={1} placeholder={t('unlimited')} />
              </label>
            </div>
            <div className="form-row">
              <label>
                {t('starts')}
                <input name="startsAt" type="date" />
              </label>
              <label>
                {t('ends')}
                <input name="endsAt" type="date" />
              </label>
            </div>
            <label className="check">
              <input type="checkbox" name="isPublic" /> {t('listCheckbox')}
            </label>
            <div>
              <SubmitButton>{t('createCoupon')}</SubmitButton>
            </div>
          </form>
        </section>
      </div>
    </>
  );
}
