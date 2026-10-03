import type { Metadata } from 'next';
import { SellerNav } from '@/components/SellerNav';
import { requireSeller } from '@/lib/sell';
import { ImportForm } from './ImportForm';

export const metadata: Metadata = { title: 'Import listings', robots: { index: false } };

const COLUMNS = [
  ['product', 'Groups rows into one listing (e.g. colors of the same item). Optional.'],
  ['title', 'Product name. Needed on the first row of a new listing.'],
  ['category', 'Category address, e.g. "speakers" or "laptops".'],
  ['description', 'What shoppers read. Needed for new listings.'],
  ['specs', 'Numbers that matter, as "name: value; name: value".'],
  ['sku', 'Your stock code. Required on every row.'],
  ['option', 'Option name, e.g. "Black" or "256GB". Defaults to "Standard".'],
  ['price', 'Price in dollars, e.g. 249.99. Required.'],
  ['compare_at_price', 'Optional "was" price, higher than the price.'],
  ['stock', 'Units on hand. Replaces the current number for existing SKUs.'],
  ['barcode', 'Optional EAN or UPC.'],
] as const;

export default async function ImportListingsPage() {
  const seller = await requireSeller('/sell/listings/import');
  const blocked = seller.status === 'SUSPENDED' || seller.status === 'REJECTED';

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <SellerNav seller={seller} current="/sell/listings" />
      <div className="two-col-sell">
        <section className="card stack">
          <h2>Import listings from a spreadsheet</h2>
          <p className="muted">
            New SKUs become draft listings. SKUs you already sell get the file&apos;s price and
            stock: the same file works for your daily stock update. We check the whole file first
            and save nothing until every row is right.
          </p>
          <p>
            <a className="btn btn--secondary btn--sm" href="/sell/listings/template.csv">
              Download the template
            </a>{' '}
            <a className="btn btn--secondary btn--sm" href="/sell/listings/export.csv">
              Download your listings
            </a>
          </p>
          {blocked ? (
            <p className="banner banner--error">Your store cannot change listings right now.</p>
          ) : (
            <ImportForm />
          )}
        </section>
        <section className="card stack">
          <h2>Columns</h2>
          <dl className="facts">
            {COLUMNS.map(([name, help]) => (
              <div key={name} style={{ display: 'contents' }}>
                <dt className="mono">{name}</dt>
                <dd>{help}</dd>
              </div>
            ))}
          </dl>
          <p className="muted" style={{ fontSize: 14 }}>
            Photos are added on each listing&apos;s page. Up to 2,000 rows per file.
          </p>
        </section>
      </div>
    </div>
  );
}
