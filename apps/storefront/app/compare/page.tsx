import { deliveryRange, INTL_LOCALE, specLabel } from '@nixzora/i18n';
import { CompareQuerySchema, type CompareView } from '@nixzora/validation';
import { Price } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CardAdd } from '@/components/CardActions';
import { Stars } from '@/components/Stars';
import { api } from '@/lib/api';
import { getLocale, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('compare');
  return { title: t('metaTitle'), robots: { index: false, follow: true } };
}

/** Compare products side by side (p10-13): /compare?products=a,b,c,d. */
export default async function ComparePage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const parsed = CompareQuerySchema.safeParse({ products: param(params, 'products') ?? '' });
  const onlyDiff = param(params, 'diff') === '1';
  const [t, c, p, locale] = await Promise.all([
    getT('compare'),
    getT('common'),
    getT('product'),
    getLocale(),
  ]);
  const view = parsed.success
    ? await api<CompareView>(`/catalog/compare?products=${parsed.data.products.join(',')}`, {
        auth: false,
        revalidate: 60,
      }).catch(() => null)
    : null;
  const products = view?.products ?? [];
  if (products.length < 2) {
    return (
      <div className="wrap section stack" style={{ gap: 16 }}>
        <h1>{t('title')}</h1>
        <p className="muted">{products.length ? t('needMore') : t('empty')}</p>
      </div>
    );
  }
  const specs = onlyDiff ? view!.differing : view!.specs;
  const differs = new Set(view!.differing);
  const base = `/compare?products=${products.map((x) => x.slug).join(',')}`;
  const value = (v: unknown) =>
    v === undefined || v === null
      ? t('none')
      : typeof v === 'boolean'
        ? v
          ? c('yes')
          : c('no')
        : String(v);

  return (
    <div className="wrap section stack" style={{ gap: 16 }}>
      <div className="section-head" style={{ marginBottom: 0 }}>
        <div className="stack" style={{ gap: 6 }}>
          <h1>{t('title')}</h1>
          <p className="muted">{t('lead')}</p>
        </div>
        <Link className="btn btn--secondary" href={onlyDiff ? base : `${base}&diff=1`}>
          {onlyDiff ? t('specs') : t('onlyDifferences')}
        </Link>
      </div>
      <div className="table-scroll compare">
        <table>
          <thead>
            <tr>
              <th scope="col" className="compare__label" />
              {products.map((product) => (
                <th scope="col" key={product.id}>
                  <Link href={`/p/${product.slug}`} className="compare__product">
                    {product.image ? (
                      // eslint-disable-next-line @next/next/no-img-element -- product photo
                      <img src={product.image.url} alt="" width={160} height={120} />
                    ) : null}
                    <span>{product.title}</span>
                  </Link>
                  <CardAdd
                    variantId={product.defaultVariantId}
                    slug={product.slug}
                    title={product.title}
                    inStock={product.inStock}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">{t('price')}</th>
              {products.map((product) => (
                <td key={product.id}>
                  <Price
                    cents={product.priceFromCents}
                    compareAtCents={product.compareAtCents}
                    currency={product.currency}
                    prefix={product.defaultVariantId ? undefined : p('from')}
                    locale={INTL_LOCALE[locale]}
                    wasLabel={p('was')}
                  />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t('rating')}</th>
              {products.map((product) => (
                <td key={product.id}>
                  {product.rating && product.rating.count && product.rating.average !== null ? (
                    <span>
                      <Stars value={product.rating.average} />{' '}
                      <span className="muted">
                        {p('reviewCount', { count: product.rating.count })}
                      </span>
                    </span>
                  ) : (
                    t('none')
                  )}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t('delivery')}</th>
              {products.map((product) => (
                <td key={product.id}>
                  {product.delivery ? deliveryRange(product.delivery, locale) : t('none')}
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t('stock')}</th>
              {products.map((product) => (
                <td key={product.id}>{product.inStock ? t('inStock') : t('soldOut')}</td>
              ))}
            </tr>
            <tr>
              <th scope="row">{t('soldBy')}</th>
              {products.map((product) => (
                <td key={product.id}>{product.seller?.displayName ?? 'NIXZORA'}</td>
              ))}
            </tr>
            <tr className="compare__section">
              <th scope="rowgroup" colSpan={products.length + 1}>
                {t('specs')}
              </th>
            </tr>
            {specs.map((key) => (
              <tr key={key} className={differs.has(key) ? 'compare__diff' : undefined}>
                <th scope="row">{specLabel(key, locale)}</th>
                {products.map((product) => (
                  <td key={product.id}>{value(product.attributes[key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
