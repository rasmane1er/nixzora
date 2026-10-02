import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner, PageHeader } from '@/components/ui';
import { catalogOptions } from '@/lib/catalog';
import { param, type SearchParams } from '@/lib/format';
import { createProduct } from '../actions';

export const metadata: Metadata = { title: 'New product' };

export default async function NewProductPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { categories, brands } = await catalogOptions();

  return (
    <>
      <PageHeader
        eyebrow="Catalog"
        title="New product"
        actions={
          <Link className="btn btn--secondary" href="/products">
            Cancel
          </Link>
        }
      />
      <Banner error={param(params, 'error')} />

      <form action={createProduct} className="form">
        <section className="card form">
          <h2>Details</h2>
          <label>
            Title
            <input name="title" required minLength={2} maxLength={200} />
          </label>
          <label>
            URL slug <span className="hint">Leave empty to create one from the title.</span>
            <input name="slug" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="kestrel-14-pro" />
          </label>
          <label>
            Description
            <textarea name="description" required rows={5} />
          </label>
          <div className="form-row">
            <label>
              Category
              <select name="categoryId" required defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.label}
                    {category.isActive ? '' : ' (hidden)'}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Brand
              <select name="brandId" defaultValue="">
                <option value="">No brand</option>
                {brands.map((brand) => (
                  <option key={brand.id} value={brand.id}>
                    {brand.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Status
              <select name="status" defaultValue="DRAFT">
                <option value="DRAFT">Draft — not visible</option>
                <option value="ACTIVE">Active — live on the store</option>
              </select>
            </label>
          </div>
          <label>
            Specifications{' '}
            <span className="hint">
              One per line, as “name = value” (names become snake_case, e.g. ram_gb).
            </span>
            <textarea
              name="attributes"
              rows={5}
              placeholder={'ram_gb = 16\nscreen = 14-inch OLED'}
            />
          </label>
        </section>

        <section className="card">
          <h2>Variants</h2>
          <p className="muted">
            Fill one row per version you sell (at least one). Rows without a SKU are ignored.
          </p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Options</th>
                  <th>Price ($)</th>
                  <th>Was ($)</th>
                  <th>Stock</th>
                </tr>
              </thead>
              <tbody>
                {[0, 1, 2, 3, 4].map((i) => (
                  <tr key={i}>
                    <td>
                      <input
                        name={`v${i}.sku`}
                        required={i === 0}
                        placeholder="KES-14-16-512"
                        aria-label={`Variant ${i + 1} SKU`}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.title`}
                        placeholder="16 GB · 512 GB"
                        aria-label={`Variant ${i + 1} name`}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.options`}
                        placeholder="Color = Graphite"
                        aria-label={`Variant ${i + 1} options`}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.price`}
                        inputMode="decimal"
                        required={i === 0}
                        placeholder="1299.00"
                        aria-label={`Variant ${i + 1} price`}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.compareAt`}
                        inputMode="decimal"
                        aria-label={`Variant ${i + 1} was price`}
                      />
                    </td>
                    <td>
                      <input
                        name={`v${i}.stock`}
                        type="number"
                        min={0}
                        defaultValue={0}
                        aria-label={`Variant ${i + 1} stock`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="hint">
            Options: “Name = value”, separate several with a semicolon (Color = Graphite; Size = 14
            in).
          </p>
        </section>

        <div>
          <SubmitButton>Create product</SubmitButton>
        </div>
      </form>
    </>
  );
}
