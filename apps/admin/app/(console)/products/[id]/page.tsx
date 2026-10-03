import { rich } from '@nixzora/i18n';
import { type ProductDetail } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner, PageHeader, StatusPill } from '@/components/ui';
import { ApiError, load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { catalogOptions } from '@/lib/catalog';
import { centsInput, pairsText, param, type SearchParams } from '@/lib/format';
import { getFormat, getT } from '@/lib/i18n';
import { addVariant, adjustStock, updateProduct, updateVariant } from '../actions';
import { CopySuggestion } from './CopySuggestion';
import { ImageOrder } from './ImageOrder';
import { ImageUpload } from './ImageUpload';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('opsCatalog');
  return { title: t('metaEditProduct') };
}

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
  const [me, product, { categories, brands }, t, tc, f] = await Promise.all([
    currentStaff(),
    loadProduct(id),
    catalogOptions(),
    getT('opsCatalog'),
    getT('common'),
    getFormat(),
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
              {t('allProducts')}
            </Link>
          </>
        }
      />
      <Banner notice={param(search, 'notice')} error={param(search, 'error')} />

      <div className="two-col">
        <div>
          <section className="card">
            <h2>{t('details')}</h2>
            <form action={updateProduct} className="form">
              <input type="hidden" name="id" value={product.id} />
              <label>
                {t('title')}
                <input name="title" defaultValue={product.title} required />
              </label>
              <label>
                {t('urlSlug')}
                <input
                  name="slug"
                  defaultValue={product.slug}
                  pattern="[a-z0-9]+(-[a-z0-9]+)*"
                  required
                />
              </label>
              <label>
                {t('description')}
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
                  {t('category')}
                  <select name="categoryId" defaultValue={categoryId} required>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('brand')}
                  <select name="brandId" defaultValue={brandId}>
                    <option value="">{t('noBrand')}</option>
                    {brands.map((brand) => (
                      <option key={brand.id} value={brand.id}>
                        {brand.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  {t('status')}
                  <select name="status" defaultValue={product.status}>
                    <option value="DRAFT">{t('status_DRAFT')}</option>
                    <option value="ACTIVE">{t('status_ACTIVE')}</option>
                    <option value="ARCHIVED">{t('status_ARCHIVED')}</option>
                  </select>
                </label>
              </div>
              <label>
                {t('specifications')} <span className="hint">{t('specsHint')}</span>
                <textarea name="attributes" defaultValue={pairsText(product.attributes)} rows={6} />
              </label>
              <div>
                <SubmitButton>{t('saveDetails')}</SubmitButton>
              </div>
            </form>
          </section>
        </div>

        <div>
          <section className="card">
            <h2>{t('images')}</h2>
            {product.images.length === 0 ? (
              <p className="muted">{t('noImages')}</p>
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
            <h2>{t('atAGlance')}</h2>
            <p>
              {rich(t('glanceFrom', { price: f.money(product.priceFromCents, product.currency) }), {
                b: (chunk) => <strong key="price">{chunk}</strong>,
              })}{' '}
              ·{' '}
              {product.inStock ? (
                t('glanceInStock')
              ) : (
                <span className="low">{t('glanceOutOfStock')}</span>
              )}
            </p>
            <p className="muted">
              {t('createdAt', { date: f.dateTime(product.createdAt) })}
              <br />
              {t('updatedAt', { date: f.dateTime(product.updatedAt) })}
            </p>
            {product.status === 'ACTIVE' ? (
              <p>
                <a
                  href={`${process.env.STOREFRONT_URL ?? 'http://localhost:3000'}/p/${product.slug}`}
                >
                  {t('viewOnStore')}
                </a>
              </p>
            ) : null}
          </section>
        </div>
      </div>

      <section className="card">
        <h2>{t('variants')}</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>{t('variantColumns')}</th>
                <th className="num">{t('colAvailable')}</th>
                {can(me, 'inventory.write') ? <th>{t('adjustStock')}</th> : null}
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
                        aria-label={t('variantName')}
                        style={{ width: 150 }}
                      />
                      <input
                        name="price"
                        defaultValue={centsInput(variant.priceCents)}
                        inputMode="decimal"
                        aria-label={t('price')}
                      />
                      <input
                        name="compareAt"
                        defaultValue={centsInput(variant.compareAtCents)}
                        inputMode="decimal"
                        aria-label={t('wasPrice')}
                        placeholder="—"
                      />
                      <input
                        name="barcode"
                        defaultValue={variant.barcode ?? ''}
                        inputMode="numeric"
                        aria-label={t('barcodeLabel')}
                        placeholder={t('barcode')}
                        style={{ width: 130 }}
                      />
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={variant.isActive}
                        aria-label={t('soldOnStore')}
                      />
                      <SubmitButton tone="secondary">{tc('save')}</SubmitButton>
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
                          aria-label={t('changeInUnits')}
                          style={{ width: 70 }}
                        />
                        <select name="reason" aria-label={t('reason')} defaultValue="RECEIVED">
                          <option value="RECEIVED">{t('reason_RECEIVED')}</option>
                          <option value="CORRECTION">{t('reason_CORRECTION')}</option>
                          <option value="DAMAGED">{t('reason_DAMAGED')}</option>
                          <option value="RETURNED">{t('reason_RETURNED')}</option>
                        </select>
                        <SubmitButton tone="secondary">{t('apply')}</SubmitButton>
                      </form>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <details style={{ marginTop: 16 }}>
          <summary>{t('addAVariant')}</summary>
          <form action={addVariant} className="form" style={{ marginTop: 12 }}>
            <input type="hidden" name="productId" value={product.id} />
            <div className="form-row">
              <label>
                SKU
                <input name="sku" required />
              </label>
              <label>
                {t('name')}
                <input name="title" required />
              </label>
              <label>
                {t('options')} <span className="hint">{t('optionsExample')}</span>
                <input name="options" />
              </label>
            </div>
            <div className="form-row">
              <label>
                {t('priceDollars')}
                <input name="price" inputMode="decimal" required />
              </label>
              <label>
                {t('wasDollars')}
                <input name="compareAt" inputMode="decimal" />
              </label>
              <label>
                {t('barcode')} <span className="hint">{t('barcodeHint')}</span>
                <input name="barcode" inputMode="numeric" />
              </label>
              <label>
                {t('startingStock')}
                <input name="stock" type="number" min={0} defaultValue={0} />
              </label>
            </div>
            <div>
              <SubmitButton>{t('addVariant')}</SubmitButton>
            </div>
          </form>
        </details>
      </section>
    </>
  );
}
