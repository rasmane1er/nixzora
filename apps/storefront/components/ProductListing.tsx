import { type PagedResult, type ProductCard as Card } from '@nixzora/validation';
import Link from 'next/link';
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
};

function href(base: string, filters: ListingFilters, page: number): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries({ ...filters, page: String(page) })) {
    if (value && !(base.startsWith('/c/') && key === 'category')) search.set(key, value);
  }
  return `${base}?${search.toString()}`;
}

/** Filters (plain GET form: works without JavaScript) plus the result grid. */
export function ProductListing({
  base,
  filters,
  result,
  brands,
}: {
  base: string;
  filters: ListingFilters;
  result: PagedResult<Card>;
  brands: { slug: string; name: string }[];
}) {
  return (
    <div className="listing">
      <form className="filters card" action={base}>
        {filters.q && base === '/search' ? (
          <input type="hidden" name="q" value={filters.q} />
        ) : null}
        <fieldset>
          <legend>Brand</legend>
          <select name="brand" defaultValue={filters.brand ?? ''} aria-label="Brand">
            <option value="">All brands</option>
            {brands.map((brand) => (
              <option key={brand.slug} value={brand.slug}>
                {brand.name}
              </option>
            ))}
          </select>
        </fieldset>
        <fieldset>
          <legend>Price (USD)</legend>
          <div className="form-row" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <input
              name="minPrice"
              inputMode="numeric"
              placeholder="Min"
              defaultValue={filters.minPrice}
              aria-label="Minimum price in dollars"
            />
            <input
              name="maxPrice"
              inputMode="numeric"
              placeholder="Max"
              defaultValue={filters.maxPrice}
              aria-label="Maximum price in dollars"
            />
          </div>
        </fieldset>
        <label className="check">
          <input
            type="checkbox"
            name="inStock"
            value="true"
            defaultChecked={filters.inStock === 'true'}
          />{' '}
          In stock only
        </label>
        <fieldset>
          <legend>Sort by</legend>
          <select
            name="sort"
            defaultValue={filters.sort ?? (filters.q ? 'relevance' : 'newest')}
            aria-label="Sort by"
          >
            {filters.q ? <option value="relevance">Best match</option> : null}
            <option value="newest">Newest</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
          </select>
        </fieldset>
        <button className="btn btn--primary" type="submit">
          Apply
        </button>
        <Link
          href={
            filters.q && base === '/search' ? `/search?q=${encodeURIComponent(filters.q)}` : base
          }
          className="btn btn--link"
        >
          Clear filters
        </Link>
      </form>

      <section aria-label="Products">
        <div className="listing__bar">
          <span className="muted">
            {result.total} {result.total === 1 ? 'product' : 'products'}
          </span>
        </div>
        {result.items.length === 0 ? (
          <div className="empty card">
            <p>Nothing matches yet. Try fewer filters or a different word.</p>
          </div>
        ) : (
          <div className="grid">
            {result.items.map((product, i) => (
              <ProductCard key={product.id} product={product} priority={i < 4} />
            ))}
          </div>
        )}
        {result.totalPages > 1 ? (
          <nav className="pager" aria-label="Pages">
            {result.page > 1 ? (
              <Link href={href(base, filters, result.page - 1)}>← Previous</Link>
            ) : (
              <span />
            )}
            <span className="muted">
              Page {result.page} of {result.totalPages}
            </span>
            {result.page < result.totalPages ? (
              <Link href={href(base, filters, result.page + 1)}>Next →</Link>
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
  };
}
