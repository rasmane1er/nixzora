import {
  BUNDLE_MAX_PERCENT,
  BUNDLE_MIN_PERCENT,
  type BundleView,
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
import { archiveBundle, createBundle } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('bundles');
  return { title: t('manageMeta') };
}

/** Bundle & save (p10-16): every bundle, and NIXZORA's own made here. */
export default async function BundlesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const [bundles, products, t, d, people, f] = await Promise.all([
    load<BundleView[]>('/admin/bundles'),
    load<PagedResult<ProductCard>>(
      `/admin/products?status=ACTIVE&pageSize=50${q ? `&q=${encodeURIComponent(q)}&sort=relevance` : '&sort=newest'}`,
    ),
    getT('bundles'),
    getT('deals'),
    getT('opsPeople'),
    getFormat(),
  ]);
  const eligible = products.items.filter((p) => p.defaultVariantId);

  return (
    <>
      <PageHeader eyebrow={people('marketing')} title={t('manageTitle')} />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />
      <p className="muted" style={{ maxWidth: '75ch' }}>
        {t('opsLead')}
      </p>

      <section className="card stack">
        <h2>{t('newBundle')}</h2>
        <form className="inline-form" action="/bundles">
          <input
            name="q"
            defaultValue={q}
            placeholder={d('chooseProduct')}
            aria-label={d('product')}
          />
          <SubmitButton tone="secondary">{d('product')}</SubmitButton>
        </form>
        <form action={createBundle} className="form">
          <div className="form-row">
            <label>
              {t('name')}
              <input
                name="title"
                required
                minLength={3}
                maxLength={80}
                placeholder={t('namePlaceholder')}
              />
            </label>
            <label>
              {t('percent')}
              <input
                name="percentOff"
                type="number"
                min={BUNDLE_MIN_PERCENT}
                max={BUNDLE_MAX_PERCENT}
                defaultValue={10}
                required
              />
            </label>
          </div>
          <fieldset className="stack" style={{ border: 0, padding: 0 }}>
            <legend>{t('pickProducts')}</legend>
            {eligible.length < 2 ? (
              <Empty>{t('noProducts')}</Empty>
            ) : (
              eligible.map((p) => (
                <label key={p.id} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="checkbox" name="productIds" value={p.id} />
                  <span>
                    {p.title} <span className="muted">· {f.money(p.priceFromCents)}</span>
                  </span>
                </label>
              ))
            )}
          </fieldset>
          <SubmitButton>{t('create')}</SubmitButton>
        </form>
      </section>

      <section className="card">
        {bundles.length === 0 ? (
          <Empty>{t('none')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colBundle')}</th>
                  <th>{t('colStore')}</th>
                  <th>{t('colProducts')}</th>
                  <th>{t('colPrice')}</th>
                  <th>{t('colStatus')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {bundles.map((b) => (
                  <tr key={b.id}>
                    <td>
                      <strong>{b.title}</strong>
                      <div className="muted small">{f.percent(b.percentOff / 100)}</div>
                    </td>
                    <td>{b.seller?.displayName ?? t('houseStore')}</td>
                    <td>
                      {b.products.map((p, i) => (
                        <span key={p.id}>
                          {i ? ' + ' : ''}
                          <Link href={`/products/${p.id}`}>{p.title}</Link>
                        </span>
                      ))}
                    </td>
                    <td>
                      {t('priceLine', {
                        bundle: f.money(b.bundlePriceCents),
                        regular: f.money(b.priceCents),
                      })}
                    </td>
                    <td>{t(`status_${b.status}`)}</td>
                    <td>
                      {b.status === 'ACTIVE' ? (
                        <ActionButton
                          action={archiveBundle}
                          label={t('archive')}
                          fields={{ id: b.id }}
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
