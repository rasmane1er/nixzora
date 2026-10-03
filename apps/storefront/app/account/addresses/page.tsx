import { type SavedAddress } from '@nixzora/validation';
import type { Metadata } from 'next';
import { AccountHeader, Notices } from '@/components/AccountHeader';
import { accountApi } from '@/lib/account';
import { param, type SearchParams } from '@/lib/params';
import { makeDefaultAddress, removeAddress, saveAddress } from '../hub-actions';
import { AddressFields } from './AddressFields';

export const metadata: Metadata = { title: 'Your addresses', robots: { index: false } };

export default async function AddressesPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const addresses = await accountApi<SavedAddress[]>('/me/addresses', '/account/addresses');

  return (
    <div className="wrap section stack" style={{ gap: 20 }}>
      <AccountHeader
        title="Your addresses"
        description="Checkout fills in your default address. We deliver within the United States."
      />
      <Notices notice={param(params, 'notice')} error={param(params, 'error')} />

      <ul className="address-cards">
        <li>
          <details className="card address-card address-card--add" open={addresses.length === 0}>
            <summary>
              <span className="address-card__plus" aria-hidden="true">
                +
              </span>
              Add an address
            </summary>
            <form action={saveAddress} className="form" style={{ marginTop: 14 }}>
              <AddressFields />
              <div>
                <button className="btn btn--primary" type="submit">
                  Save address
                </button>
              </div>
            </form>
          </details>
        </li>
        {addresses.map((address) => (
          <li key={address.id} id={`a-${address.id}`}>
            <div className="card address-card">
              <div className="stack" style={{ gap: 2 }}>
                {address.isDefaultShipping ? (
                  <span className="eyebrow" style={{ marginBottom: 4 }}>
                    Default
                  </span>
                ) : null}
                {address.label ? <strong>{address.label}</strong> : null}
                <span>{address.fullName}</span>
                <span>{address.line1}</span>
                {address.line2 ? <span>{address.line2}</span> : null}
                <span>
                  {address.city}, {address.region} {address.postalCode}
                </span>
                <span className="muted">United States</span>
                {address.phone ? <span className="muted">Phone: {address.phone}</span> : null}
              </div>
              <div className="address-card__actions">
                <details>
                  <summary>Edit</summary>
                  <form action={saveAddress} className="form" style={{ marginTop: 12 }}>
                    <input type="hidden" name="id" value={address.id} />
                    <AddressFields address={address} />
                    <div>
                      <button className="btn btn--primary btn--sm" type="submit">
                        Save changes
                      </button>
                    </div>
                  </form>
                </details>
                <form action={removeAddress}>
                  <input type="hidden" name="id" value={address.id} />
                  <button className="btn btn--link" type="submit">
                    Remove
                  </button>
                </form>
                {!address.isDefaultShipping ? (
                  <form action={makeDefaultAddress}>
                    <input type="hidden" name="id" value={address.id} />
                    <button className="btn btn--link" type="submit">
                      Set as default
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
