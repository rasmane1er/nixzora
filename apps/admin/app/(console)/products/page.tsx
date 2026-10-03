import { type PagedResult, type ProductCard } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Banner, Empty, PageHeader, Pager, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { param, query, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsCatalog');
  return { title: t('metaProducts') };
}

type Row = ProductCard & { status: string };

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const status = param(params, 'status');
  const category = param(params, 'category');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const sort = q ? 'relevance' : 'newest';

  const [t, tc, f] = await Promise.all([getT('opsCatalog'), getT('common'), getFormat()]);
  const result = await load<PagedResult<Row>>(
    `/admin/products${query({ q, status, category, page, pageSize: 25, sort })}`,
  );

  return (
    <>
      <PageHeader
        eyebrow={t('eyebrowCatalog')}
        title={t('metaProducts')}
        actions={
          <Link className="btn btn--primary" href="/products/new">
            {t('newProduct')}
          </Link>
        }
      />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <form className="toolbar" role="search">
        <label>
          {tc('search')}
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder={t('productSearchPlaceholder')}
          />
        </label>
        <label>
          {t('status')}
          <select name="status" defaultValue={status ?? ''}>
            <option value="">{t('any')}</option>
            <option value="ACTIVE">{t('status_ACTIVE')}</option>
            <option value="DRAFT">{t('status_DRAFT')}</option>
            <option value="ARCHIVED">{t('status_ARCHIVED')}</option>
          </select>
        </label>
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <button className="btn btn--secondary" type="submit">
          {t('filter')}
        </button>
      </form>

      <section className="card">
        {result.items.length === 0 ? (
          <Empty>{t('noProductsMatch')}</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>{t('colProduct')}</th>
                  <th>{t('category')}</th>
                  <th>{t('status')}</th>
                  <th className="num">{t('colFrom')}</th>
                  <th>{t('stock')}</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link href={`/products/${product.id}`}>{product.title}</Link>
                      <div className="muted">{product.brand?.name ?? t('noBrand')}</div>
                    </td>
                    <td>{product.category.name}</td>
                    <td>
                      <StatusPill value={product.status} />
                    </td>
                    <td className="num">{f.money(product.priceFromCents, product.currency)}</td>
                    <td className={product.inStock ? undefined : 'low'}>
                      {product.inStock ? t('inStock') : t('outOfStock')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager
          page={result.page}
          totalPages={result.totalPages}
          href={(n) => `/products${query({ q, status, category, page: n })}`}
        />
      </section>
      <p className="muted">
        {category
          ? t('productCountInCategory', { count: result.total, category })
          : t('productCount', { count: result.total })}
        {category ? (
          <>
            {' · '}
            <Link href="/products">{t('showAll')}</Link>
          </>
        ) : null}
      </p>
    </>
  );
}
