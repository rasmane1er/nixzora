'use client';

import { type OrderView } from '@nixzora/validation';
import { useActionState } from 'react';
import { requestReturn, type ReturnState } from './actions';

const REASONS = [
  ['DAMAGED', 'Arrived damaged'],
  ['NOT_AS_DESCRIBED', 'Not as described'],
  ['WRONG_ITEM', 'Wrong item sent'],
  ['NO_LONGER_NEEDED', 'No longer needed'],
  ['OTHER', 'Something else'],
] as const;

export function ReturnForm({ order, token }: { order: OrderView; token?: string }) {
  const [state, action, pending] = useActionState<ReturnState, FormData>(requestReturn, {});
  if (state.ok) {
    return (
      <p className="banner banner--ok" role="status">
        Return requested. We’ll email you the next steps within one business day.
      </p>
    );
  }
  return (
    <details className="card">
      <summary>Start a return</summary>
      <form action={action} className="form" style={{ marginTop: 14 }}>
        <input type="hidden" name="number" value={order.number} />
        <input type="hidden" name="token" value={token ?? ''} />
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>Which items?</legend>
          {order.items.map((item) => (
            <div key={item.id} className="check" style={{ justifyContent: 'space-between' }}>
              <label className="check">
                <input type="checkbox" name="item" value={item.id} /> {item.productTitle}
                <span className="muted"> · {item.variantTitle}</span>
              </label>
              {item.quantity > 1 ? (
                <select
                  name={`qty-${item.id}`}
                  aria-label={`How many ${item.productTitle}`}
                  defaultValue={1}
                >
                  {Array.from({ length: item.quantity }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="hidden" name={`qty-${item.id}`} value={1} />
              )}
            </div>
          ))}
        </fieldset>
        <label>
          Reason
          <select name="reason" defaultValue="DAMAGED">
            {REASONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Anything we should know? <span className="hint">Optional</span>
          <textarea name="note" rows={3} maxLength={1000} />
        </label>
        {state.error ? (
          <p className="banner banner--error" role="alert">
            {state.error}
          </p>
        ) : null}
        <div>
          <button className="btn btn--primary" type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Request return'}
          </button>
        </div>
      </form>
    </details>
  );
}
