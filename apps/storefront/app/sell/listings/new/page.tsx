import type { Metadata } from 'next';
import { Notices, SellerNav } from '@/components/SellerNav';
import { param, type SearchParams } from '@/lib/params';
import { categoryOptions, requireSeller } from '@/lib/sell';
import { createListing } from '../../actions';

export const metadata: Metadata = { title: 'Add a listing', robots: { index: false } };

export default async function NewListingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const [seller, categories] = await Promise.all([
    requireSeller('/sell/listings/new'),
    categoryOptions(),
  ]);
  const blocked = seller.status === 'SUSPENDED' || seller.status === 'REJECTED';

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/listings" />
      <Notices error={param(params, 'error')} />
      {blocked ? (
        <p className="banner banner--error">Your store cannot add listings right now.</p>
      ) : (
        <form action={createListing} className="card form" style={{ maxWidth: 760 }}>
          <h2>Add a listing</h2>
          <p className="muted">
            Saved as a draft. Add a photo next, then submit it for review. Shoppers find products by
            their specs, so include the numbers that matter.
          </p>
          <label>
            Product name
            <input name="title" required minLength={2} maxLength={200} />
          </label>
          <label>
            Category
            <select name="categoryId" required defaultValue="">
              <option value="" disabled>
                Choose a category
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Description
            <textarea name="description" rows={5} required maxLength={20000} />
          </label>
          <label>
            Specs <span className="hint">One per line, e.g. “battery_hours: 30”.</span>
            <textarea name="specs" rows={4} placeholder={'weight_g: 250\nbluetooth: 5.4'} />
          </label>
          <fieldset className="form" style={{ border: 0, padding: 0, margin: 0 }}>
            <legend>
              <strong>Price and stock</strong>{' '}
              <span className="hint">You can add more options (colors, sizes) after saving.</span>
            </legend>
            <div className="form-row">
              <label>
                SKU <span className="hint">Your stock code</span>
                <input
                  name="sku"
                  required
                  pattern="[A-Za-z0-9][A-Za-z0-9\-]{2,63}"
                  placeholder="BL-SPK-WAL"
                />
              </label>
              <label>
                Option name
                <input name="variantTitle" placeholder="Standard" maxLength={120} />
              </label>
            </div>
            <div className="form-row">
              <label>
                Price (USD)
                <input name="price" required inputMode="decimal" placeholder="249.00" />
              </label>
              <label>
                Was <span className="hint">Optional</span>
                <input name="compareAt" inputMode="decimal" placeholder="299.00" />
              </label>
              <label>
                In stock
                <input name="stock" type="number" min={0} max={1000000} defaultValue={0} />
              </label>
            </div>
          </fieldset>
          <div>
            <button className="btn btn--primary" type="submit">
              Save draft
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
