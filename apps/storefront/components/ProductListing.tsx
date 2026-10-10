import { filterValueLabel, optionLabel, specLabel } from '@nixzora/i18n';
import {
  type Facet,
  FILTER_PATTERN,
  type PagedResult,
  type ProductCard as Card,
  type SponsoredProduct,
} from '@nixzora/validation';
import Link from 'next/link';
import { getLocale, getT } from '@/lib/i18n';
import { AboutAds } from './AboutAds';
import { ProductCard } from './ProductCard';

export type ListingFilters = {
  q?: string;
  category?: string;
  brand?: string;
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
  sort?: string;
  page?: string;
  /** Spec and option filters, "key:value" (p10-03). */
  f?: string[];
};

function href(base: string, filters: ListingFilters, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page: String(page) })) {
    if (Array.isArray(value)) value.forEach((v) => search.append(key, v));
    else if (value && !(base.startsWith('/c/') && key === 'category')) search.set(key, value);
  }
  return `${base}?${search.toString()}`;
}

/** Filters (plain GET form: works without JavaScript) plus the result grid. */
export async function ProductListing({
  base,
  filters,
  result,
  brands,
  sponsored = [],
  facets = [],
}: {
  base: string;
  filters: ListingFilters;
  result: PagedResult<Card>;
  brands: { slug: string; name: string }[];
  /** Sponsored products shown first in the grid. */
  sponsored?: SponsoredProduct[];
  /** Spec and option filters with counts. */
  facets?: Facet[];
}) {
  const t = await getT('catalog');
  const p = await getT('product');
  const locale = await getLocale();
  const facetName = (facet: Facet) =>
    facet.kind === 'option' ? optionLabel(facet.key, locale) : specLabel(facet.key, locale);
  return (
    <div className="listing">
      <form className="filters card" action={base}>
        {filters.q && base === '/search' ? (
          <input type="hidden" name="q" value={filters.q} />
        ) : null}
        <fieldset>
          <legend>{t('brand')}</legend>
          <select name="brand" defaultValue={filters.brand ?? ''} aria-label={t('brand')}>
            <option value="">{t('allBrands')}</option>
            {brands.map((brand) => (
              <option key={brand.slug} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </fieldset>
        <fieldset>
          <legend>{t('priceUsd')}</legend>
          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input
              name="minPrice"
              inputMode="numeric"
              placeholder={t('min')}
              defaultValue={filters.minPrice}
              aria-label={t('minPriceLabel')}
            />
            <input
              name="maxPrice"
              inputMode="numeric"
              placeholder={t('max')}
              defaultValue={filters.maxPrice}
              aria-label={t('maxPriceLabel')}
            />
          </div>
        </fieldset>
        {facets.map((facet) => (
          <fieldset key={facet.key}>
            <legend>{facetName(facet)}</legend>
            <div className="facet-values">
              {facet.values.map((v) => (
                <label key={v.value} className="check">
                  <input
                    type="checkbox"
                    name="f"
                    value={`${facet.key}:${v.value}`}
                    defaultChecked={v.selected}
                  />{' '}
                  {filterValueLabel(v.value, locale)} <span className="count">({v.count})</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <label className="check">
          <input
            type="checkbox"
            name="inStock"
            value="true"
            defaultChecked={filters.inStock === 'true'}
          />{' '}
          {t('inStockOnly')}
        </label>
        <fieldset>
          <legend>{t('sortBy')}</legend>
          <select
            name="sort"
            defaultValue={filters.sort ?? (filters.q ? 'relevance' : 'newest')}
            aria-label={t('sortBy')}
          >
            {filters.q ? <option value="relevance">{t('sortRelevance')}</option> : null}
            <option value="newest">{t('sortNewest')}</option>
            <option value="price_asc">{t('sortPriceAsc')}</option>
            <option value="price_desc">{t('sortPriceDesc')}</option>
          </select>
        </fieldset>
        <button className="btn btn--primary" type="submit">
          {t('apply')}
        </button>
        <Link
          href={
            filters.q && base === '/search' ? `/search?q=${encodeURIComponent(filters.q)}` : base
          }
          className="btn btn--link"
        >
          {t('clearFilters')}
        </Link>
      </form>

      <section aria-label={t('productsLabel')}>
        <div className="listing__bar">
          <span className="muted">{p('products', { count: result.total })}</span>
        </div>
        {/* Sponsored products (p10-01) lead the grid, each labelled; only with real results. */}
        {sponsored.length && result.items.length ? <AboutAds /> : null}
        {result.items.length === 0 ? (
          <div className="empty card">
            <p>{t('noResults')}</p>
          </div>
        ) : (
          <div className="grid">
            {sponsored.map((ad) => (
              <ProductCard key={`ad-${ad.product.id}`} product={ad.product} adToken={ad.token} />
            ))}
            {result.items.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
        )}
        {result.totalPages > 1 ? (
          <nav className="pager" aria-label={t('pages')}>
            {result.page > 1 ? (
              <Link href={href(base, filters, result.page - 1)}>{t('previous')}</Link>
            ) : (
              <span />
            )}
            <span className="muted">
              {t('pageOf', { page: result.page, total: result.totalPages })}
            </span>
            {result.page < result.totalPages ? (
              <Link href={href(base, filters, result.page + 1)}>{t('next')}</Link>
            ) : (
              <span />
            )}
          </nav>
        ) : null}
      </section>
    </div>
  );
}

/** Dollars typed in the filter → cents the API expects. */
export function toApiQuery(filters: ListingFilters, extra: Record<string, string> = {}): string {
  const search = new URLSearchParams();
  const dollars = (value?: string) => {
    const n = Number(value);
    return value && Number.isFinite(n) && n >= 0 ? String(Math.round(n * 100)) : undefined;
  };
  const values: Record<string, string | undefined> = {
    q: filters.q,
    category: filters.category,
    brand: filters.brand,
    minPrice: dollars(filters.minPrice),
    maxPrice: dollars(filters.maxPrice),
    inStock: filters.inStock === 'true' ? 'true' : undefined,
    sort:
      filters.sort && ['relevance', 'newest', 'price_asc', 'price_desc'].includes(filters.sort)
        ? filters.sort
        : filters.q
          ? 'relevance'
          : 'newest',
    page: filters.page && /^\d{1,3}$/.test(filters.page) ? filters.page : '1',
    pageSize: '24',
    ...extra,
  };
  for (const [key, value] of Object.entries(values)) if (value) search.set(key, value);
  for (const filter of filters.f ?? []) search.append('f', filter);
  return `?${search.toString()}`;
}

export function filtersFrom(params: Record<string, string | string[] | undefined>): ListingFilters {
  const get = (name: string) => {
    const value = params[name];
    const first = Array.isArray(value) ? value[0] : value;
    return first ? first.slice(0, 200) : undefined;
  };
  return {
    q: get('q'),
    category: get('category'),
    brand: get('brand'),
    minPrice: get('minPrice'),
    maxPrice: get('maxPrice'),
    inStock: get('inStock'),
    sort: get('sort'),
    page: get('page'),
    f: [params.f ?? []]
      .flat()
      .filter((v): v is string => typeof v === 'string' && FILTER_PATTERN.test(v))
      .slice(0, 30),
  };
}
