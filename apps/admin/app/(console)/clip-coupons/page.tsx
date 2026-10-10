import { type ClipCouponView, type PagedResult, type ProductCard } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { TimezoneOffset } from '@/components/TimezoneOffset';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { createClipCoupon, endClipCoupon } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('clips');
  return { title: t('manageMeta') };
}

/** Clip coupons (p10-18): every store's, and NIXZORA's own made here. */
export default async function ClipCouponsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const [coupons, products, t, people, f] = await Promise.all([
    load<ClipCouponView[]>('/admin/clip-coupons'),
    load<PagedResult<ProductCard>>(
      `/admin/products?status=ACTIVE&pageSize=50${q ? `&q=${encodeURIComponent(q)}&sort=relevance` : '&sort=newest'}`,
    ),
    getT('clips'),
    getT('opsPeople'),
    getFormat(),
  ]);
  const label = (c: ClipCouponView) =>
    c.kind === 'PERCENT'
      ? t('badgePercent', { percent: f.percent((c.percentOff ?? 0) / 100) })
      : t('badgeAmount', { amount: f.money(c.amountOffCents ?? 0) });

  return (
    <>
      <PageHeader eyebrow={people('marketing')} title={t('manageTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ maxWidth: '75ch' }}>
        {t('opsLead')}
      </p>
      <section className="card stack">
        <h2>{t('newCoupon')}</h2>
        <form className="inline-form" action="/clip-coupons">
          <input
            name="q"
            defaultValue={q}
            placeholder={t('chooseProduct')}
            aria-label={t('product')}
          />
          <SubmitButton tone="secondary">{t('product')}</SubmitButton>
        </form>
        <form action={createClipCoupon} className="form">
          <TimezoneOffset />
          <div className="form-row">
            <label>
              {t('product')}
              <select name="productId" required defaultValue="">
                <option value="" disabled>
                  {t('chooseProduct')}
                </option>
                {products.items.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('kind')}
              <select name="kind" defaultValue="PERCENT">
                <option value="PERCENT">{t('kind_PERCENT')}</option>
                <option value="AMOUNT">{t('kind_AMOUNT')}</option>
              </select>
            </label>
            <label>
              {t('percent')} / {t('amount')}
              <input name="value" type="number" min={1} step="0.01" required defaultValue={10} />
            </label>
          </div>
          <div className="form-row">
            <label>
              {t('starts')}
              <input name="startsAt" type="datetime-local" />
            </label>
            <label>
              {t('ends')}
              <input name="endsAt" type="datetime-local" required />
            </label>
            <label>
              {t('budget')}
              <input name="maxRedemptions" type="number" min={1} />
            </label>
          </div>
          <SubmitButton>{t('create')}</SubmitButton>
        </form>
      </section>
      <section className="card">
        {coupons.length === 0 ? (
          <Empty>{t('noCoupons')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colProduct')}</th>
                  <th>{t('colStore')}</th>
                  <th>{t('colCoupon')}</th>
                  <th>{t('colWhen')}</th>
                  <th>{t('colClips')}</th>
                  <th>{t('colUsed')}</th>
                  <th>{t('colStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/products/${c.product.id}`}>{c.product.title}</Link>
                    </td>
                    <td>{c.seller?.displayName ?? t('houseStore')}</td>
                    <td>{label(c)}</td>
                    <td>
                      {t('when', { start: f.dateTime(c.startsAt), end: f.dateTime(c.endsAt) })}
                    </td>
                    <td>{f.number(c.clips)}</td>
                    <td>
                      {c.maxRedemptions != null
                        ? t('usedOf', {
                            used: f.number(c.redeemed),
                            max: f.number(c.maxRedemptions),
                          })
                        : f.number(c.redeemed)}
                    </td>
                    <td>{t(`status_${c.status}`)}</td>
                    <td>
                      {c.status === 'ACTIVE' ? (
                        <ActionButton
                          action={endClipCoupon}
                          label={t('end')}
                          fields={{ id: c.id }}
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
