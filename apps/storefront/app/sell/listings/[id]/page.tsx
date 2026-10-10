import { type SizeChartView, type ProductDetail } from '@nixzora/validation';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api, ApiError } from '@/lib/api';
import { getFormat, getT } from '@/lib/i18n';
import { param, type SearchParams } from '@/lib/params';
import { categoryOptions, requireSeller, specsText } from '@/lib/sell';
import {
  addVariant,
  adjustStock,
  submitListing,
  updateListing,
  updateVariant,
  withdrawListing,
} from '../../actions';
import { DescriptionAssistant } from './DescriptionAssistant';
import { PhotoOrder } from './PhotoOrder';
import { PhotoUpload } from './PhotoUpload';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT('sellerTools');
  return { title: t('metaEditListing'), robots: { index: false } };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const dollars = (cents: number | null) => (cents == null ? '' : (cents / 100).toFixed(2));

export default async function ListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const search = await searchParams;
  const seller = await requireSeller(`/sell/listings/${id}`);
  let product: ProductDetail;
  try {
    product = await api<ProductDetail>(`/seller/products/${id}`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
  const [categories, t, f] = await Promise.all([
    categoryOptions(),
    getT('sellerTools'),
    getFormat(),
  ]);
  const tc = await getT('common');
  // Size & fit guide (p10-26): clothing and shoe listings choose a size chart.
  const charts = product.sizeGuide
    ? await api<SizeChartView[]>('/seller/size-charts').catch((): SizeChartView[] => [])
    : [];
  const sg = await getT('sizeGuide');
  const categoryId = categories.find((c) => c.slug === product.category.slug)?.id;
  const canSubmit =
    seller.status === 'ACTIVE' && (product.status === 'DRAFT' || product.status === 'ARCHIVED');

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/listings" />
      <Notices notice={param(search, 'notice')} error={param(search, 'error')} />

      <section className="card stack">
        <div className="section-head" style={{ marginBottom: 0 }}>
          <div className="stack" style={{ gap: 4 }}>
            <p className="eyebrow">
              <Link href="/sell/listings">{t('breadcrumbListings')}</Link>
            </p>
            <h2>{product.title}</h2>
            <p>
              <span className={`pill pill--listing-${product.status.toLowerCase()}`}>
                {t(`listing_${product.status}`)}
              </span>{' '}
              <span className="muted">{t(`statusHelp_${product.status}`)}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {product.status === 'ACTIVE' ? (
              <Link className="btn btn--secondary" href={`/p/${product.slug}`}>
                {t('viewInStore')}
              </Link>
            ) : null}
            {canSubmit ? (
              <form action={submitListing}>
                <input type="hidden" name="id" value={product.id} />
                <button className="btn btn--primary" type="submit">
                  {t('submitForReview')}
                </button>
              </form>
            ) : null}
            {product.status === 'ACTIVE' || product.status === 'PENDING_REVIEW' ? (
              <form action={withdrawListing}>
                <input type="hidden" name="id" value={product.id} />
                <button className="btn btn--secondary" type="submit">
                  {product.status === 'ACTIVE' ? t('takeOffSale') : t('withdraw')}
                </button>
              </form>
            ) : null}
          </div>
        </div>
        {product.reviewNote ? (
          <p className="banner banner--info">
            <strong>{t('changesRequestedLabel')}</strong> {product.reviewNote}
          </p>
        ) : null}
        {seller.status === 'PENDING' && product.status === 'DRAFT' ? (
          <p className="muted" style={{ fontSize: 14 }}>
            {t('submitOnceApproved')}
          </p>
        ) : null}
      </section>

      <div className="two-col-sell">
        <form action={updateListing} className="card form">
          <h2>{t('detailsTitle')}</h2>
          <input type="hidden" name="id" value={product.id} />
          <label>
            {t('fieldProductName')}
            <input name="title" required defaultValue={product.title} maxLength={200} />
          </label>
          <label>
            {t('fieldCategory')}
            <select name="categoryId" defaultValue={categoryId}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          {product.sizeGuide ? (
            <label>
              {sg('listingChart')}{' '}
              <Link className="hint" href="/sell/size-charts">
                {sg('navTitle')}
              </Link>
              <select name="sizeChartId" defaultValue={product.sizeChartId ?? ''}>
                <option value="">{sg('listingChartDefault')}</option>
                {charts.map((chart) => (
                  <option key={chart.id} value={chart.id}>
                    {chart.name} · {chart.categoryName}
                    {chart.nixzora ? ` · ${sg('nixzora')}` : ''}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label>
            {t('fieldDescription')}
            <textarea
              id="listing-description"
              name="description"
              rows={6}
              required
              defaultValue={product.description}
            />
          </label>
          <DescriptionAssistant productId={product.id} target="listing-description" />
          <label>
            {t('fieldSpecs')} <span className="hint">{t('specsHintEdit')}</span>
            <textarea name="specs" rows={5} defaultValue={specsText(product.attributes)} />
          </label>
          <div>
            <button className="btn btn--primary" type="submit">
              {t('saveDetails')}
            </button>
          </div>
        </form>

        <section className="card stack">
          <h2>{t('photosTitle')}</h2>
          {product.images.length ? (
            <PhotoOrder productId={product.id} photos={product.images} />
          ) : (
            <p className="muted">{t('needPhoto')}</p>
          )}
          <PhotoUpload
            productId={product.id}
            defaultAlt={product.title}
            existing={product.images.length}
          />
        </section>
      </div>

      <section className="card stack">
        <h2>{t('optionsTitle')}</h2>
        <div className="table-scroll">
          <table className="plain">
            <thead>
              <tr>
                <th>{t('colOption')}</th>
                <th>{t('colPrice')}</th>
                <th className="num">{t('colAvailable')}</th>
                <th>{t('colAdjustStock')}</th>
              </tr>
            </thead>
            <tbody>
              {product.variants.map((variant) => (
                <tr key={variant.id}>
                  <td>
                    <strong>{variant.title}</strong>
                    <div className="muted mono" style={{ fontSize: 13 }}>
                      {variant.sku}
                      {variant.isActive ? '' : ` · ${t('hidden')}`}
                    </div>
                  </td>
                  <td>
                    <form action={updateVariant} className="inline-form">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="variantId" value={variant.id} />
                      <input
                        name="price"
                        aria-label={t('ariaPriceOf', { option: variant.title })}
                        defaultValue={dollars(variant.priceCents)}
                        inputMode="decimal"
                        size={8}
                      />
                      <input
                        name="compareAt"
                        aria-label={t('ariaWasPriceOf', { option: variant.title })}
                        placeholder={t('fieldWas')}
                        defaultValue={dollars(variant.compareAtCents)}
                        inputMode="decimal"
                        size={8}
                      />
                      <label className="check" style={{ fontSize: 14 }}>
                        <input type="checkbox" name="isActive" defaultChecked={variant.isActive} />
                        {t('onSale')}
                      </label>
                      <button className="btn btn--secondary btn--sm" type="submit">
                        {tc('save')}
                      </button>
                    </form>
                  </td>
                  <td className="num">{f.number(variant.available)}</td>
                  <td>
                    <form action={adjustStock} className="inline-form">
                      <input type="hidden" name="productId" value={product.id} />
                      <input type="hidden" name="variantId" value={variant.id} />
                      <input
                        name="delta"
                        type="number"
                        aria-label={t('ariaUnitsFor', { option: variant.title })}
                        placeholder={t('deltaPlaceholder')}
                        required
                        style={{ width: 110 }}
                      />
                      <button className="btn btn--secondary btn--sm" type="submit">
                        {t('update')}
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="muted" style={{ fontSize: 14 }}>
          {t('lowestPrice', { price: f.money(product.priceFromCents, product.currency) })}
        </p>

        <details>
          <summary>{t('addAnotherOption')}</summary>
          <form action={addVariant} className="form" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={product.id} />
            <div className="form-row">
              <label>
                {t('fieldOptionName')}
                <input
                  name="variantTitle"
                  required
                  placeholder={t('optionPlaceholderExample')}
                  maxLength={120}
                />
              </label>
              <label>
                {t('fieldSku')}
                <input name="sku" required pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,63}" />
              </label>
            </div>
            <div className="form-row">
              <label>
                {t('fieldPrice')}
                <input name="price" required inputMode="decimal" />
              </label>
              <label>
                {t('fieldWas')} <span className="hint">{t('hintOptional')}</span>
                <input name="compareAt" inputMode="decimal" />
              </label>
              <label>
                {t('fieldInStock')}
                <input name="stock" type="number" min={0} defaultValue={0} />
              </label>
            </div>
            <div>
              <button className="btn btn--secondary" type="submit">
                {t('addOption')}
              </button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
