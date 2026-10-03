'use client';

import { type OrderView } from '@nixzora/validation';
import { useActionState } from 'react';
import { useT } from '@/components/I18nProvider';
import { requestReturn, type ReturnState } from './actions';

const REASONS = ['DAMAGED', 'NOT_AS_DESCRIBED', 'WRONG_ITEM', 'NO_LONGER_NEEDED', 'OTHER'] as const;

export function ReturnForm({ order, token }: { order: OrderView; token?: string }) {
  const t = useT('order');
  const [state, action, pending] = useActionState<ReturnState, FormData>(requestReturn, {});
  if (state.ok) {
    return (
      <p className="banner banner--ok" role="status">
        {t('returnRequested')}
      </p>
    );
  }
  return (
    <details className="card" id="return">
      <summary>{t('startReturn')}</summary>
      <form action={action} className="form" style={{ marginTop: 14 }}>
        <input type="hidden" name="number" value={order.number} />
        <input type="hidden" name="token" value={token ?? ''} />
        <fieldset className="stack" style={{ border: 0, padding: 0, margin: 0, gap: 8 }}>
          <legend style={{ fontWeight: 600, marginBottom: 6 }}>{t('whichItems')}</legend>
          {order.items.map((item) => (
            <div key={item.id} className="check" style={{ justifyContent: 'space-between' }}>
              <label className="check">
                <input type="checkbox" name="item" value={item.id} /> {item.productTitle}
                <span className="muted"> · {item.variantTitle}</span>
              </label>
              {item.quantity > 1 ? (
                <select
                  name={`qty-${item.id}`}
                  aria-label={t('howMany', { title: item.productTitle })}
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
          {t('reason')}
          <select name="reason" defaultValue="DAMAGED">
            {REASONS.map((value) => (
              <option key={value} value={value}>
                {t(`reason_${value}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('anythingToKnow')} <span className="hint">{t('optional')}</span>
          <textarea name="note" rows={3} maxLength={1000} />
        </label>
        {state.error ? (
          <p className="banner banner--error" role="alert">
            {state.error}
          </p>
        ) : null}
        <div>
          <button className="btn btn--primary" type="submit" disabled={pending}>
            {pending ? t('sending') : t('requestReturn')}
          </button>
        </div>
      </form>
    </details>
  );
}
