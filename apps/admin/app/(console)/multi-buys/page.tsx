import { multiBuyTerms } from '@nixzora/i18n';
import {
  MULTI_BUY_MAX_BUY,
  MULTI_BUY_MAX_GET,
  type MultiBuyView,
  type PagedResult,
  type ProductCard,
} from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { ActionButton, Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { createMultiBuy, endMultiBuy } from './actions';

const PERCENTS = [100, 50, 25] as const;
const DAYS = [7, 14, 30, 90] as const;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('multiBuy');
  return { title: t('navTitle') };
}

/** Buy X, get Y (p10-27): every offer, and NIXZORA's own made here. */
export default async function MultiBuysPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const [offers, products, t, d, people, f] = await Promise.all([
    load<MultiBuyView[]>('/admin/multi-buys'),
    load<PagedResult<ProductCard>>(
      `/admin/products?status=ACTIVE&pageSize=50${q ? `&q=${encodeURIComponent(q)}&sort=relevance` : '&sort=newest'}`,
    ),
    getT('multiBuy'),
    getT('deals'),
    getT('opsPeople'),
    getFormat(),
  ]);
  const live = new Set(
    offers.filter((o) => o.status === 'ACTIVE').flatMap((o) => o.products.map((p) => p.id)),
  );

  return (
    <>
      <PageHeader eyebrow={people('marketing')} title={t('navTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ maxWidth: '75ch' }}>
        {t('leadOps')}
      </p>

      <section className="card stack">
        <h2>{t('newOffer')}</h2>
        <form className="inline-form" action="/multi-buys">
          <input
            name="q"
            defaultValue={q}
            placeholder={d('chooseProduct')}
            aria-label={d('product')}
          />
          <SubmitButton tone="secondary">{d('product')}</SubmitButton>
        </form>
        <form action={createMultiBuy} className="form">
          <div className="form-row">
            <label>
              {t('buy')}
              <select name="buyQty" defaultValue={2}>
                {Array.from({ length: MULTI_BUY_MAX_BUY }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('get')}
              <select name="getQty" defaultValue={1}>
                {Array.from({ length: MULTI_BUY_MAX_GET }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t('reward')}
              <select name="percentOff" defaultValue={100}>
                {PERCENTS.map((p) => (
                  <option key={p} value={p}>
                    {p === 100 ? t('free') : t('percentOption', { percent: p })}
                  </option>
                ))}
              </select>
            </label>
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
          </div>
          <fieldset className="stack" style={{ border: 0, padding: 0 }}>
            <legend>
              {t('products')} <span className="hint">{t('productsHint')}</span>
            </legend>
            {products.items.map((p) => (
              <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" name="productIds" value={p.id} disabled={live.has(p.id)} />
                <span className={live.has(p.id) ? 'muted' : undefined}>
                  {p.title} <span className="muted">· {f.money(p.priceFromCents)}</span>
                </span>
              </label>
            ))}
          </fieldset>
          <SubmitButton>{t('create')}</SubmitButton>
        </form>
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
                  <th>{t('products')}</th>
                  <th>{t('runFor')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {offers.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong>{multiBuyTerms(t, o)}</strong>
                      <div className="muted small">
                        {t(`status_${o.status}`)} · {t('orders', { count: o.orders })}
                      </div>
                    </td>
                    <td>{o.seller?.displayName ?? t('nixzora')}</td>
                    <td>
                      {o.products.map((p, i) => (
                        <span key={p.id}>
                          {i ? ', ' : ''}
                          <Link href={`/products/${p.id}`}>{p.title}</Link>
                        </span>
                      ))}
                    </td>
                    <td>{o.endsAt ? t('endsOn', { date: f.date(o.endsAt) }) : t('noEnd')}</td>
                    <td>
                      {o.status === 'ACTIVE' ? (
                        <ActionButton action={endMultiBuy} label={t('end')} fields={{ id: o.id }} />
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
