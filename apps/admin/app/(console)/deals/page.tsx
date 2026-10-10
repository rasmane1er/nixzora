import {
  DEAL_MAX_PERCENT,
  DEAL_MIN_PERCENT,
  type DealView,
  type PagedResult,
  type ProductCard,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { TimezoneOffset } from '@/components/TimezoneOffset';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { cancelDeal, createDeal } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('deals');
  return { title: t('manageMeta') };
}

/** Deals (p10-07): every store's deals, and NIXZORA's own on any product. */
export default async function DealsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const [deals, products, t, people, f] = await Promise.all([
    load<DealView[]>('/admin/deals'),
    load<PagedResult<ProductCard>>(
      `/admin/products?status=ACTIVE&pageSize=50${q ? `&q=${encodeURIComponent(q)}&sort=relevance` : '&sort=newest'}`,
    ),
    getT('deals'),
    getT('opsPeople'),
    getFormat(),
  ]);

  return (
    <>
      <PageHeader eyebrow={people('marketing')} title={t('manageTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ maxWidth: '75ch' }}>
        {t('manageLead')}
      </p>

      <section className="card stack">
        <h2>{t('newDeal')}</h2>
        <form className="inline-form" action="/deals">
          <input
            name="q"
            defaultValue={q}
            placeholder={t('chooseProduct')}
            aria-label={t('product')}
          />
          <SubmitButton tone="secondary">{t('product')}</SubmitButton>
        </form>
        <form action={createDeal} className="form">
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
                    {p.title} · {f.money(p.priceFromCents)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('audience')}
              <select name="audience" defaultValue="EVERYONE">
                <option value="EVERYONE">{t('audience_EVERYONE')}</option>
                <option value="PLUS">{t('audience_PLUS')}</option>
              </select>
            </label>
            <label>
              {t('kind')}
              <select name="kind" defaultValue="DAY">
                <option value="DAY">{t('kind_DAY')}</option>
                <option value="LIGHTNING">{t('kind_LIGHTNING')}</option>
              </select>
            </label>
            <label>
              {t('percent')}
              <input
                name="percentOff"
                type="number"
                min={DEAL_MIN_PERCENT}
                max={DEAL_MAX_PERCENT}
                defaultValue={20}
                required
              />
            </label>
            <label>
              {t('starts')}
              <input name="startsAt" type="datetime-local" required />
            </label>
            <label>
              {t('ends')}
              <input name="endsAt" type="datetime-local" required />
            </label>
            <label>
              {t('quantity')}
              <input name="quantity" type="number" min={1} max={100000} />
            </label>
          </div>
          <p className="muted">
            {t('quantityHint')} {t('timesHint')}
          </p>
          <SubmitButton tone="primary">{t('schedule')}</SubmitButton>
        </form>
      </section>

      <section className="card">
        {deals.length === 0 ? (
          <Empty>{t('noDeals')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colProduct')}</th>
                  <th>{t('colStore')}</th>
                  <th>{t('colDeal')}</th>
                  <th>{t('colWhen')}</th>
                  <th>{t('colSold')}</th>
                  <th>{t('colStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {deals.map((deal) => (
                  <tr key={deal.id}>
                    <td>
                      <Link href={`/products/${deal.product.id}`}>{deal.product.title}</Link>
                    </td>
                    <td>{deal.seller?.displayName ?? t('houseStore')}</td>
                    <td>
                      {t(deal.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')} ·{' '}
                      {t('percentOff', { percent: f.percent(deal.percentOff / 100) })}
                      {deal.audience === 'PLUS' ? ` · ${t('audience_PLUS')}` : null}
                    </td>
                    <td>
                      {t('when', {
                        start: f.dateTime(deal.startsAt),
                        end: f.dateTime(deal.endsAt),
                      })}
                    </td>
                    <td>
                      {deal.quantity != null
                        ? t('soldOf', {
                            claimed: f.number(deal.claimed),
                            quantity: f.number(deal.quantity),
                          })
                        : f.number(deal.claimed)}
                    </td>
                    <td>{t(`status_${deal.status}`)}</td>
                    <td>
                      {deal.status === 'LIVE' || deal.status === 'SCHEDULED' ? (
                        <ActionButton
                          action={cancelDeal}
                          label={deal.status === 'LIVE' ? t('endNow') : t('cancel')}
                          fields={{ id: deal.id }}
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
