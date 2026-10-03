import { type ProductDetail } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notices, SellerNav } from '@/components/SellerNav';
import { api, ApiError } from '@/lib/api';
import { param, type SearchParams } from '@/lib/params';
import { categoryOptions, LISTING_STATUS_LABEL, requireSeller, specsText } from '@/lib/sell';
import {
  addVariant,
  adjustStock,
  removePhoto,
  submitListing,
  updateListing,
  updateVariant,
  withdrawListing,
} from '../../actions';
import { PhotoUpload } from './PhotoUpload';

export const metadata: Metadata = { title: 'Edit listing', robots: { index: false } };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const STATUS_HELP: Record<string, string> = {
  DRAFT: 'Only you can see this listing. Submit it when it is ready.',
  PENDING_REVIEW: 'Our team is reviewing this listing, usually within one business day.',
  ACTIVE:
    'Live on NIXZORA. Price and stock changes apply at once; changes to the name, description, specs or photos go back to review.',
  ARCHIVED: 'Archived: hidden from the store.',
};

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
  const categories = await categoryOptions();
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
              <Link href="/sell/listings">Listings</Link>
            </p>
            <h2>{product.title}</h2>
            <p>
              <span className={`pill pill--listing-${product.status.toLowerCase()}`}>
                {LISTING_STATUS_LABEL[product.status]}
              </span>{' '}
              <span className="muted">{STATUS_HELP[product.status]}</span>
            </p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {product.status === 'ACTIVE' ? (
              <Link className="btn btn--secondary" href={`/p/${product.slug}`}>
                View in store
              </Link>
            ) : null}
            {canSubmit ? (
              <form action={submitListing}>
                <input type="hidden" name="id" value={product.id} />
                <button className="btn btn--primary" type="submit">
                  Submit for review
                </button>
              </form>
            ) : null}
            {product.status === 'ACTIVE' || product.status === 'PENDING_REVIEW' ? (
              <form action={withdrawListing}>
                <input type="hidden" name="id" value={product.id} />
                <button className="btn btn--secondary" type="submit">
                  {product.status === 'ACTIVE' ? 'Take off sale' : 'Withdraw'}
                </button>
              </form>
            ) : null}
          </div>
        </div>
        {product.reviewNote ? (
          <p className="banner banner--info">
            <strong>Changes requested:</strong> {product.reviewNote}
          </p>
        ) : null}
        {seller.status === 'PENDING' && product.status === 'DRAFT' ? (
          <p className="muted" style={{ fontSize: 14 }}>
            You can submit listings once your store is approved.
          </p>
        ) : null}
      </section>

      <div className="two-col-sell">
        <form action={updateListing} className="card form">
          <h2>Details</h2>
          <input type="hidden" name="id" value={product.id} />
          <label>
            Product name
            <input name="title" required defaultValue={product.title} maxLength={200} />
          </label>
          <label>
            Category
            <select name="categoryId" defaultValue={categoryId}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <textarea name="description" rows={6} required defaultValue={product.description} />
          </label>
          <label>
            Specs <span className="hint">One per line, “name: value”.</span>
            <textarea name="specs" rows={5} defaultValue={specsText(product.attributes)} />
          </label>
          <div>
            <button className="btn btn--primary" type="submit">
              Save details
            </button>
          </div>
        </form>

        <section className="card stack">
          <h2>Photos</h2>
          {product.images.length ? (
            <div className="seller-photos">
              {product.images.map((image) => (
                <figure key={image.id}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image.url} alt={image.alt} width={120} height={120} />
                  <form action={removePhoto}>
                    <input type="hidden" name="id" value={product.id} />
                    <input type="hidden" name="imageId" value={image.id} />
                    <button className="btn btn--link" type="submit">
                      Remove
                    </button>
                  </form>
                </figure>
              ))}
            </div>
          ) : (
            <p className="muted">Listings need at least one photo before review.</p>
          )}
          <PhotoUpload productId={product.id} defaultAlt={product.title} />
        </section>
      </div>

      <section className="card stack">
        <h2>Options, prices and stock</h2>
        <table className="plain">
          <thead>
            <tr>
              <th>Option</th>
              <th>Price</th>
              <th className="num">Available</th>
              <th>Add or remove stock</th>
            </tr>
          </thead>
          <tbody>
            {product.variants.map((variant) => (
              <tr key={variant.id}>
                <td>
                  <strong>{variant.title}</strong>
                  <div className="muted mono" style={{ fontSize: 13 }}>
                    {variant.sku}
                    {variant.isActive ? '' : ' · hidden'}
                  </div>
                </td>
                <td>
                  <form action={updateVariant} className="inline-form">
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="variantId" value={variant.id} />
                    <input
                      name="price"
                      aria-label={`Price of ${variant.title}`}
                      defaultValue={dollars(variant.priceCents)}
                      inputMode="decimal"
                      size={8}
                    />
                    <input
                      name="compareAt"
                      aria-label={`Was price of ${variant.title}`}
                      placeholder="Was"
                      defaultValue={dollars(variant.compareAtCents)}
                      inputMode="decimal"
                      size={8}
                    />
                    <label className="check" style={{ fontSize: 14 }}>
                      <input type="checkbox" name="isActive" defaultChecked={variant.isActive} />
                      On sale
                    </label>
                    <button className="btn btn--secondary btn--sm" type="submit">
                      Save
                    </button>
                  </form>
                </td>
                <td className="num">{variant.available}</td>
                <td>
                  <form action={adjustStock} className="inline-form">
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="variantId" value={variant.id} />
                    <input
                      name="delta"
                      type="number"
                      aria-label={`Units to add or remove for ${variant.title}`}
                      placeholder="+10 or -2"
                      required
                      style={{ width: 110 }}
                    />
                    <button className="btn btn--secondary btn--sm" type="submit">
                      Update
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="muted" style={{ fontSize: 14 }}>
          Lowest price shown to shoppers: {formatMoney(product.priceFromCents, product.currency)}
        </p>

        <details>
          <summary>Add another option (color, size, capacity)</summary>
          <form action={addVariant} className="form" style={{ marginTop: 12 }}>
            <input type="hidden" name="id" value={product.id} />
            <div className="form-row">
              <label>
                Option name
                <input name="variantTitle" required placeholder="Sand" maxLength={120} />
              </label>
              <label>
                SKU
                <input name="sku" required pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,63}" />
              </label>
            </div>
            <div className="form-row">
              <label>
                Price (USD)
                <input name="price" required inputMode="decimal" />
              </label>
              <label>
                Was <span className="hint">Optional</span>
                <input name="compareAt" inputMode="decimal" />
              </label>
              <label>
                In stock
                <input name="stock" type="number" min={0} defaultValue={0} />
              </label>
            </div>
            <div>
              <button className="btn btn--secondary" type="submit">
                Add option
              </button>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
