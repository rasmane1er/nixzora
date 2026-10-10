'use client';

import { useEffect, useState } from 'react';
import { useFormat, useT } from './I18nProvider';

/** "3:07:15" for what is left of a deal (hours may pass 24 for day deals). */
export function remaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * A live deal's countdown ("Ends in 3:07:15"), or its end date when it is days away, plus a
 * "64% claimed" bar for limited deals. Renders the server's text first, then ticks.
 */
export function DealTimer({
  endsAt,
  claimedPercent,
  initialNow,
}: {
  endsAt: string;
  claimedPercent?: number | null;
  /** The server's clock when it rendered, so the first paint matches. */
  initialNow: number;
}) {
  const t = useT('deals');
  const f = useFormat();
  const [now, setNow] = useState(initialNow);
  const end = Date.parse(endsAt);
  const left = end - now;

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="deal-timer">
      <span className="deal-timer__time">
        {left <= 0
          ? t('ended')
          : left > 48 * 3_600_000
            ? t('endsOn', { date: f.date(endsAt) })
            : t('endsIn', { time: remaining(left) })}
      </span>
      {claimedPercent != null ? (
        <span className="deal-claimed">
          <span className="deal-claimed__bar" aria-hidden="true">
            <span style={{ width: `${Math.min(100, claimedPercent)}%` }} />
          </span>
          <span>{t('claimed', { percent: f.percent(claimedPercent / 100) })}</span>
        </span>
      ) : null}
    </span>
  );
}
