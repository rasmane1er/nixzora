'use client';

import { sellerProceeds } from '@nixzora/validation';
import { useState } from 'react';
import { useFormat, useT } from '@/components/I18nProvider';

/** What one sale earns: commission on the item price only (shipping passes through). */
export function FeeCalculator({ commissionBps }: { commissionBps: number }) {
  const t = useT('sellApply');
  const f = useFormat();
  const usd = (cents: number) => f.money(cents);
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
          {t('itemPrice')}
          <input
            inputMode="decimal"
            value={price}
            onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ''))}
            aria-describedby="fee-result"
          />
        </label>
        <label>
          {t('shippingCustomerPays')}
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
            <td>{t('calcCustomerPays')}</td>
            <td className="num">{usd(item + ship)}</td>
          </tr>
          <tr>
            <td>{t('calcCommission', { rate: f.percent(commissionBps / 10_000) })}</td>
            <td className="num">−{usd(commissionCents)}</td>
          </tr>
          <tr className="fee-calc__total">
            <td>{t('yourProceeds')}</td>
            <td className="num">{usd(proceedsCents)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
