import { type PagedResult, type ProductCard } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { Banner, Empty, PageHeader, Pager, StatusPill } from '@/components/ui';
import { load } from '@/lib/api';
import { money, param, query, type SearchParams } from '@/lib/format';

export const metadata: Metadata = { title: 'Products' };

type Row = ProductCard & { status: string };

export default async function ProductsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const status = param(params, 'status');
  const category = param(params, 'category');
  const page = Number(param(params, 'page') ?? 1) || 1;
  const sort = q ? 'relevance' : 'newest';

  const result = await load<PagedResult<Row>>(
    `/admin/products${query({ q, status, category, page, pageSize: 25, sort })}`,
  );

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        actions={
          <Link className="btn btn--primary" href="/products/new">
            New product
          </Link>
        }
      />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <form className="toolbar" role="search">
        <label>
          Search
          <input type="search" name="q" defaultValue={q} placeholder="Title, brand or SKU words" />
        </label>
        <label>
          Status
          <select name="status" defaultValue={status ?? ''}>
            <option value="">Any</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        {category ? <input type="hidden" name="category" value={category} /> : null}
        <button className="btn btn--secondary" type="submit">
          Filter
        </button>
      </form>

      <section className="card">
        {result.items.length === 0 ? (
          <Empty>No products match.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Status</th>
                  <th className="num">From</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {result.items.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <Link href={`/products/${product.id}`}>{product.title}</Link>
                      <div className="muted">{product.brand?.name ?? 'No brand'}</div>
                    </td>
                    <td>{product.category.name}</td>
                    <td>
                      <StatusPill value={product.status} />
                    </td>
                    <td className="num">{money(product.priceFromCents, product.currency)}</td>
                    <td className={product.inStock ? undefined : 'low'}>
                      {product.inStock ? 'In stock' : 'Out of stock'}
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
        {result.total} products{category ? ` in “${category}” and its subcategories` : ''}
        {category ? (
          <>
            {' · '}
            <Link href="/products">Show all</Link>
          </>
        ) : null}
      </p>
    </>
  );
}
