'use client';

import { sellerProceeds } from '@nixzora/validation';
import { useState } from 'react';

const usd = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { style: 'currency', currency: 'USD' });

/** What one sale earns: commission on the item price only (shipping passes through). */
export function FeeCalculator({ commissionBps }: { commissionBps: number }) {
  const [price, setPrice] = useState('100');
  const [shipping, setShipping] = useState('0');
  const toCents = (value: string) => Math.max(0, Math.round(Number(value || 0) * 100)) || 0;
  const item = toCents(price);
  const ship = toCents(shipping);
  const { commissionCents, proceedsCents } = sellerProceeds(item, ship, commissionBps);

  return (
    <div className="fee-calc">
      <div className="form-row">
        <label>
          Item price
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
            aria-describedby="fee-result"
          />
        </label>
        <label>
          Shipping the customer pays
          <input
            inputMode="decimal"
            value={shipping}
            onChange={(e) => setShipping(e.target.value.replace(/[^\d.]/g, ''))}
            aria-describedby="fee-result"
          />
        </label>
      </div>
      <table className="fee-calc__table" id="fee-result" aria-live="polite">
        <tbody>
          <tr>
            <td>Customer pays (before tax)</td>
            <td className="num">{usd(item + ship)}</td>
          </tr>
          <tr>
            <td>NIXZORA commission ({commissionBps / 100}% of the item price)</td>
            <td className="num">−{usd(commissionCents)}</td>
          </tr>
          <tr className="fee-calc__total">
            <td>Your proceeds</td>
            <td className="num">{usd(proceedsCents)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
