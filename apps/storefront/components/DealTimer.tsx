'use client';

import { clockText, countdownPhase } from '@nixzora/validation';
import { useNow } from './Countdown';
import { useFormat, useT } from './I18nProvider';

/** "3:07:15" for what is left of a deal. */
export const remaining = clockText;

/**
 * A live deal's countdown ("Ends in 3:07:15") in its last 24 hours, "Ending soon" in the last
 * hour, otherwise its end date (p10-38); plus a "64% claimed" bar for limited deals. Renders
 * the server's text first, then ticks on the page's shared clock.
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
  const tc = useT('countdown');
  const f = useFormat();
  const now = useNow(1000, initialNow) ?? initialNow;
  const end = Date.parse(endsAt);
  const left = end - now;
  const phase = countdownPhase(end, now);

  return (
    <span className="deal-timer">
      <span className="deal-timer__time" role={phase === 'later' ? undefined : 'timer'}>
        {phase === 'ended'
          ? t('ended')
          : phase === 'later'
            ? t('endsOn', { date: f.date(endsAt) })
            : t('endsIn', { time: remaining(left) })}
        {phase === 'soon' ? <span className="deal-soon">{tc('endingSoon')}</span> : null}
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
