import type { Metadata } from 'next';
import Link from 'next/link';
import { SubmitButton } from '@/components/SubmitButton';
import { Banner, Empty, PageHeader } from '@/components/ui';
import { load } from '@/lib/api';
import { can, currentStaff } from '@/lib/auth';
import { param, query, type SearchParams } from '@/lib/format';
import { adjustStock } from '../products/actions';

export const metadata: Metadata = { title: 'Inventory' };

type StockRow = {
  variantId: string;
  sku: string;
  variantTitle: string;
  productId: string;
  productTitle: string;
  onHand: number;
  reserved: number;
  available: number;
};

export default async function InventoryPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = param(params, 'q');
  const lowStock = param(params, 'lowStock');
  const [me, rows] = await Promise.all([
    currentStaff(),
    load<StockRow[]>(`/admin/inventory${query({ q, lowStock })}`),
  ]);
  const back = `/inventory${query({ q, lowStock })}`;

  return (
    <>
      <PageHeader eyebrow="Operations" title="Inventory" />
      <Banner notice={param(params, 'notice')} error={param(params, 'error')} />

      <form className="toolbar" role="search">
        <label>
          Search
          <input type="search" name="q" defaultValue={q} placeholder="SKU or product" />
        </label>
        <label>
          Show
          <select name="lowStock" defaultValue={lowStock ?? ''}>
            <option value="">All variants</option>
            <option value="0">Sold out</option>
            <option value="5">5 or fewer available</option>
            <option value="20">20 or fewer available</option>
          </select>
        </label>
        <button className="btn btn--secondary" type="submit">
          Filter
        </button>
      </form>

      <section className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          <strong>On hand</strong> is what is in the warehouse. <strong>Held</strong> is in
          shoppers’ checkouts (released after 15 minutes if unpaid). <strong>Available</strong> is
          what can still be sold.
        </p>
        {rows.length === 0 ? (
          <Empty>No variants match.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product</th>
                  <th className="num">On hand</th>
                  <th className="num">Held</th>
                  <th className="num">Available</th>
                  <th>Adjust</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.variantId}>
                    <td className="mono">{row.sku}</td>
                    <td>
                      {can(me, 'catalog.write') ? (
                        <Link href={`/products/${row.productId}`}>{row.productTitle}</Link>
                      ) : (
                        row.productTitle
                      )}
                      <div className="muted">{row.variantTitle}</div>
                    </td>
                    <td className="num">{row.onHand}</td>
                    <td className="num">{row.reserved}</td>
                    <td className={`num${row.available <= 5 ? ' low' : ''}`}>{row.available}</td>
                    <td>
                      <form action={adjustStock} className="inline-form">
                        <input type="hidden" name="variantId" value={row.variantId} />
                        <input type="hidden" name="back" value={back} />
                        <input
                          name="delta"
                          type="number"
                          required
                          placeholder="+10"
                          aria-label={`Change for ${row.sku}`}
                          style={{ width: 70 }}
                        />
                        <select name="reason" defaultValue="RECEIVED" aria-label="Reason">
                          <option value="RECEIVED">Received</option>
                          <option value="CORRECTION">Count fix</option>
                          <option value="DAMAGED">Damaged</option>
                          <option value="RETURNED">Returned</option>
                        </select>
                        <input
                          name="note"
                          placeholder="Note"
                          aria-label="Note"
                          style={{ width: 120 }}
                        />
                        <SubmitButton tone="secondary">Apply</SubmitButton>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {rows.length === 500 ? (
          <p className="muted">Showing the first 500. Search to narrow down.</p>
        ) : null}
      </section>
    </>
  );
}
