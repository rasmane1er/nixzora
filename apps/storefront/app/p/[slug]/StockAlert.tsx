'use client';

import { useState, useTransition } from 'react';
import { useT } from '@/components/I18nProvider';
import { setStockAlert } from './actions';

/** "Notify me when it is back" on a sold-out product (p10-06). */
export function StockAlert({
  productId,
  slug,
  signedIn,
  initial,
}: {
  productId: string;
  slug: string;
  signedIn: boolean;
  initial: boolean;
}) {
  const c = useT('community');
  const [on, setOn] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!signedIn) {
    return (
      <a
        className="btn btn--secondary btn--block"
        href={`/account/login?next=${encodeURIComponent(`/p/${slug}`)}`}
      >
        {c('notifySignIn')}
      </a>
    );
  }
  return (
    <div className="stack" style={{ gap: 6 }}>
      {on ? (
        <p className="banner banner--ok" role="status">
          {c('notifyOn')}
        </p>
      ) : null}
      <button
        type="button"
        className={`btn ${on ? 'btn--link' : 'btn--secondary btn--block'}`}
        disabled={pending}
        onClick={() =>
          start(async () => {
            const result = await setStockAlert(productId, !on);
            if (!result.ok) return setError(result.error);
            setError(null);
            setOn(!on);
          })
        }
      >
        {on ? c('notifyOff') : c('notifyMe')}
      </button>
      {error ? (
        <span className="hint" role="alert" style={{ color: 'var(--err-fg)' }}>
          {error}
        </span>
      ) : null}
    </div>
  );
}
