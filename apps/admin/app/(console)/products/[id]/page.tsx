import { type ProductDetail } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner, PageHeader, StatusPill } from '@/components/ui';
import { ApiError, load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { catalogOptions } from '@/lib/catalog';
import { centsInput, dateTime, money, pairsText, param, type SearchParams } from '@/lib/format';
import { addVariant, adjustStock, updateProduct, updateVariant } from '../actions';
import { CopySuggestion } from './CopySuggestion';
import { ImageOrder } from './ImageOrder';
import { ImageUpload } from './ImageUpload';

export const metadata: Metadata = { title: 'Edit product' };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function loadProduct(id: string): Promise<ProductDetail> {
  if (!UUID.test(id)) notFound();
  try {
    return await load<ProductDetail>(`/admin/products/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const search = await searchParams;
  const [me, product, { categories, brands }] = await Promise.all([
    currentStaff(),
    loadProduct(id),
    catalogOptions(),
  ]);
  const categoryId = categories.find((c) => c.slug === product.category.slug)?.id;
  const brandId = brands.find((b) => b.slug === product.brand?.slug)?.id ?? '';
  const back = `/products/${product.id}`;

  return (
    <>
      <PageHeader
        eyebrow={product.breadcrumb.map((c) => c.name).join(' › ')}
        title={product.title}
        actions={
          <>
            <StatusPill value={product.status} />
            <Link className="btn btn--secondary" href="/products">
              All products
            </Link>
          </>
        }
      />
      <Banner notice={param(search, 'notice')} error={param(search, 'error')} />

      <div className="two-col">
        <div>
          <section className="card">
            <h2>Details</h2>
            <form action={updateProduct} className="form">
              <input type="hidden" name="id" value={product.id} />
              <label>
                Title
                <input name="title" defaultValue={product.title} required />
              </label>
              <label>
                URL slug
                <input
                  name="slug"
                  defaultValue={product.slug}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  required
                />
              </label>
              <label>
                Description
                <textarea
                  id="product-description"
                  name="description"
                  defaultValue={product.description}
                  rows={6}
                  required
                />
              </label>
              <CopySuggestion productId={product.id} target="product-description" />
              <div className="form-row">
                <label>
                  Category
                  <select name="categoryId" defaultValue={categoryId} required>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Brand
                  <select name="brandId" defaultValue={brandId}>
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
                  <select name="status" defaultValue={product.status}>
                    <option value="DRAFT">Draft</option>
                    <option value="ACTIVE">Active</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </label>
              </div>
              <label>
                Specifications{' '}
                <span className="hint">
                  One per line, as “name = value” (names become snake_case, e.g. ram_gb).
                </span>
                <textarea name="attributes" defaultValue={pairsText(product.attributes)} rows={6} />
              </label>
              <div>
                <SubmitButton>Save details</SubmitButton>
              </div>
            </form>
          </section>
        </div>

        <div>
          <section className="card">
            <h2>Images</h2>
            {product.images.length === 0 ? (
              <p className="muted">
                No images yet. The first image is the one shoppers see in lists.
              </p>
            ) : (
              <div style={{ marginBottom: 16 }}>
                <ImageOrder productId={product.id} photos={product.images} />
              </div>
            )}
            <ImageUpload
              productId={product.id}
              defaultAlt={product.title}
              existing={product.images.length}
            />
          </section>

          <section className="card">
            <h2>At a glance</h2>
            <p>
              From <strong>{money(product.priceFromCents, product.currency)}</strong> ·{' '}
              {product.inStock ? 'in stock' : <span className="low">out of stock</span>}
            </p>
            <p className="muted">
              Created {dateTime(product.createdAt)}
              <br />
              Updated {dateTime(product.updatedAt)}
            </p>
            {product.status === 'ACTIVE' ? (
              <p>
                <a
                  href={`${process.env.STOREFRONT_URL ?? 'http://localhost:3000'}/p/${product.slug}`}
                >
                  View on the store →
                </a>
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <section className="card">
        <h2>Variants</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Name · price · was · live</th>
                <th className="num">Available</th>
                {can(me, 'inventory.write') ? <th>Adjust stock</th> : null}
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr key={variant.id}>
                  <td className="mono nowrap">
                    {variant.sku}
                    <div className="options">{pairsText(variant.options).replace(/\n/g, '; ')}</div>
                  </td>
                  <td>
                    <form action={updateVariant} className="inline-form">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="variantId" value={variant.id} />
                      <input
                        name="title"
                        defaultValue={variant.title}
                        aria-label="Variant name"
                        style={{ width: 150 }}
                      />
                      <input
                        name="price"
                        defaultValue={centsInput(variant.priceCents)}
                        inputMode="decimal"
                        aria-label="Price"
                      />
                      <input
                        name="compareAt"
                        defaultValue={centsInput(variant.compareAtCents)}
                        inputMode="decimal"
                        aria-label="Was price"
                        placeholder="—"
                      />
                      <input
                        name="barcode"
                        defaultValue={variant.barcode ?? ''}
                        inputMode="numeric"
                        aria-label="Barcode (EAN or UPC)"
                        placeholder="Barcode"
                        style={{ width: 130 }}
                      />
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={variant.isActive}
                        aria-label="Sold on the store"
                      />
                      <SubmitButton tone="secondary">Save</SubmitButton>
                    </form>
                  </td>
                  <td className={`num${variant.available <= 5 ? ' low' : ''}`}>
                    {variant.available}
                  </td>
                  {can(me, 'inventory.write') ? (
                    <td>
                      <form action={adjustStock} className="inline-form">
                        <input type="hidden" name="variantId" value={variant.id} />
                        <input type="hidden" name="back" value={back} />
                        <input
                          name="delta"
                          type="number"
                          required
                          placeholder="+10"
                          aria-label="Change in units"
                          style={{ width: 70 }}
                        />
                        <select name="reason" aria-label="Reason" defaultValue="RECEIVED">
                          <option value="RECEIVED">Received</option>
                          <option value="CORRECTION">Count fix</option>
                          <option value="DAMAGED">Damaged</option>
                          <option value="RETURNED">Returned</option>
                        </select>
                        <SubmitButton tone="secondary">Apply</SubmitButton>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details style={{ marginTop: 16 }}>
          <summary>Add a variant</summary>
          <form action={addVariant} className="form" style={{ marginTop: 12 }}>
            <input type="hidden" name="productId" value={product.id} />
            <div className="form-row">
              <label>
                SKU
                <input name="sku" required />
              </label>
              <label>
                Name
                <input name="title" required />
              </label>
              <label>
                Options <span className="hint">Color = Silver; Size = 14 in</span>
                <input name="options" />
              </label>
            </div>
            <div className="form-row">
              <label>
                Price ($)
                <input name="price" inputMode="decimal" required />
              </label>
              <label>
                Was ($)
                <input name="compareAt" inputMode="decimal" />
              </label>
              <label>
                Barcode <span className="hint">EAN or UPC on the box</span>
                <input name="barcode" inputMode="numeric" />
              </label>
              <label>
                Starting stock
                <input name="stock" type="number" min={0} defaultValue={0} />
              </label>
            </div>
            <div>
              <SubmitButton>Add variant</SubmitButton>
            </div>
          </form>
        </details>
      </section>
    </>
  );
}
