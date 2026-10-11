'use client';

import { type MessageKey } from '@nixzora/i18n';
import { countdownPhase, durationText, orderCutoff } from '@nixzora/validation';
import { useEffect, useState } from 'react';
import { useT } from './I18nProvider';

// One clock for the whole page (p10-38): every countdown subscribes to the same tick, so a
// long grid of cards runs a single timer.
const listeners = new Set<(now: number) => void>();
let ticker: ReturnType<typeof setInterval> | null = null;

function subscribe(listener: (now: number) => void): () => void {
  listeners.add(listener);
  if (!ticker) ticker = setInterval(() => listeners.forEach((l) => l(Date.now())), 1000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size && ticker) {
      clearInterval(ticker);
      ticker = null;
    }
  };
}

/**
 * The time now, updated every `stepMs` (1 s for clocks, a minute for "2 h 15 min"). Starts from
 * `initial` (the server's clock) so the first paint matches; null before mount without it.
 */
export function useNow(stepMs = 1000, initial: number | null = null): number | null {
  const [now, setNow] = useState<number | null>(initial);
  useEffect(() => {
    // The client's clock as soon as it's mounted, then on each step.
    const first = setTimeout(() => setNow(Date.now()), 0);
    let last = Math.floor(Date.now() / stepMs);
    const unsubscribe = subscribe((at) => {
      const step = Math.floor(at / stepMs);
      if (step !== last) {
        last = step;
        setNow(at);
      }
    });
    return () => {
      clearTimeout(first);
      unsubscribe();
    };
  }, [stepMs]);
  return now;
}

/**
 * A deadline (p10-38): `later` (the server's "Ends Fri, Oct 16") until the last 24 hours, then
 * "Ends in 5 h 42 min" (or the `soon` message), red in the last hour.
 */
export function Deadline({
  until,
  later,
  soon = 'endsIn',
  className,
}: {
  until: string;
  later: string;
  soon?: MessageKey<'countdown'>;
  className?: string;
}) {
  const t = useT('countdown');
  const now = useNow(60_000);
  const end = Date.parse(until);
  const phase = now === null ? 'later' : countdownPhase(end, now);
  if (phase === 'later') return <span className={className}>{later}</span>;
  return (
    <span className={`${className ?? ''} deadline deadline--${phase}`.trim()} role="timer">
      {phase === 'ended' ? t('ended') : t(soon, { time: durationText(end - now!) })}
    </span>
  );
}

/**
 * "Order within 2 h 15 min" (p10-38): how long until today's order cutoff keeps the dates
 * shown. Only when the cutoff is under 24 hours away; otherwise `fallback` (the usual hint).
 */
export function OrderWithin({
  twoDay = false,
  fallback,
}: {
  twoDay?: boolean;
  fallback: React.ReactNode;
}) {
  const t = useT('countdown');
  const now = useNow(60_000);
  if (now === null) return <>{fallback}</>;
  const left = orderCutoff(new Date(now)).getTime() - now;
  if (countdownPhase(now + left, now) === 'later') return <>{fallback}</>;
  return (
    <span className="order-within" role="timer">
      <strong>{t('orderWithin', { time: durationText(left) })}</strong>
      <span className="muted">
        {' · '}
        {t(twoDay ? 'orderWithinHintTwoDay' : 'orderWithinHint')}
      </span>
    </span>
  );
}
