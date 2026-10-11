import { easternDayStart } from './budget';
import { addDays, CUTOFF_HOUR_EASTERN, eastern, isBusinessDay } from './delivery';

/**
 * Countdowns (p10-38): deadlines show as a date until the last 24 hours, then count down, with
 * "Ending soon" in the last hour. Every countdown comes from a real end time the server sent;
 * nothing resets on reload.
 */
export const COUNTDOWN_WINDOW_MS = 24 * 3_600_000;
export const ENDING_SOON_MS = 3_600_000;

export type CountdownPhase = 'later' | 'counting' | 'soon' | 'ended';

export function countdownPhase(endMs: number, nowMs: number): CountdownPhase {
  const left = endMs - nowMs;
  if (left <= 0) return 'ended';
  if (left <= ENDING_SOON_MS) return 'soon';
  if (left <= COUNTDOWN_WINDOW_MS) return 'counting';
  return 'later';
}

/** "3:07:15": hours, minutes and seconds left, never negative. */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** "2 h 15 min", "42 min", "<1 min": what's left, to the minute (the same in en, fr and es). */
export function durationText(ms: number): string {
  const minutes = Math.floor(Math.max(0, ms) / 60_000);
  if (minutes < 1) return '<1 min';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/**
 * The next order cutoff (2 pm Eastern on a business day): ordering before it keeps the delivery
 * dates shown now. After it, or on a weekend or holiday, it's the next business day's.
 */
export function orderCutoff(now = new Date()): Date {
  const { day, hour } = eastern(now);
  let start = hour < CUTOFF_HOUR_EASTERN && isBusinessDay(day) ? day : addDays(day, 1);
  while (!isBusinessDay(start)) start = addDays(start, 1);
  return new Date(easternDayStart(start).getTime() + CUTOFF_HOUR_EASTERN * 3_600_000);
}
