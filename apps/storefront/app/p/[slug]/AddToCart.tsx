'use client';

import { type Variant } from '@nixzora/validation';
import { formatMoney } from '@nixzora/ui';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import { addToCart } from '../../cart/actions';

/** Variant picker + quantity + add to cart. Prices shown here are display only; the server re-prices. */
export function AddToCart({ variants }: { variants: Variant[] }) {
  const buyable = variants.filter((variant) => variant.isActive);
  const firstInStock = buyable.find((variant) => variant.available > 0) ?? buyable[0];
  const [selectedId, setSelectedId] = useState(firstInStock?.id);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const selected = useMemo(() => buyable.find((v) => v.id === selectedId), [buyable, selectedId]);

  if (!selected)
    return <p className="banner banner--info">This product is not available right now.</p>;
  const max = Math.min(10, selected.available);

  function add() {
    if (!selected) return;
    setStatus(null);
    startTransition(async () => {
      const result = await addToCart(selected.id, quantity);
      setStatus(
        result.ok
          ? { kind: 'ok', text: 'Added to your cart.' }
          : { kind: 'error', text: result.error },
      );
    });
  }

  return (
    <div className="stack">
      {buyable.length > 1 ? (
        <div className="options" role="group" aria-label="Choose an option">
          <span style={{ fontWeight: 600 }}>Choose</span>
          <div className="option-list">
            {buyable.map((variant) => (
              <button
                key={variant.id}
                type="button"
                className="option"
                aria-pressed={variant.id === selectedId}
                disabled={variant.available === 0}
                onClick={() => {
                  setSelectedId(variant.id);
                  setQuantity(1);
                  setStatus(null);
                }}
              >
                <span>{variant.title}</span>
                <small>
                  {variant.available === 0
                    ? 'Sold out'
                    : formatMoney(variant.priceCents, variant.currency)}
                </small>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="qty">
        <label>
          Quantity
          <select
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
            disabled={max === 0}
          >
            {Array.from({ length: Math.max(1, max) }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn btn--primary"
          type="button"
          onClick={add}
          disabled={pending || max === 0}
          style={{ flex: 1 }}
        >
          {max === 0
            ? 'Sold out'
            : pending
              ? 'Adding…'
              : `Add to cart · ${formatMoney(selected.priceCents * quantity, selected.currency)}`}
        </button>
      </div>
      <span
        className={`stock${selected.available === 0 ? ' stock--out' : selected.available <= 5 ? ' stock--low' : ''}`}
      >
        {selected.available === 0
          ? 'Sold out'
          : selected.available <= 5
            ? `Only ${selected.available} left`
            : 'In stock · ships in 1–2 business days'}
      </span>
      {status ? (
        <p
          className={`banner banner--${status.kind === 'ok' ? 'ok' : 'error'}`}
          role={status.kind === 'ok' ? 'status' : 'alert'}
        >
          {status.text} {status.kind === 'ok' ? <Link href="/cart">View cart →</Link> : null}
        </p>
      ) : null}
      <p className="muted mono" style={{ fontSize: 12 }}>
        SKU {selected.sku}
      </p>
    </div>
  );
}
