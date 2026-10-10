import { type PriceHistory } from '@nixzora/validation';

const DAY_MS = 86_400_000;

/**
 * Summarizes a product's price steps over the last `days` (p10-19). `points` are every change
 * up to now, oldest first, including the last one before the window (it sets the price at the
 * window's start). The typical price is time-weighted, so a one-hour flash price barely moves it.
 */
export function summarizePrices(
  points: { at: Date; priceCents: number }[],
  currentCents: number,
  days: number,
  currency: string,
  now = new Date(),
): PriceHistory {
  const start = new Date(now.getTime() - days * DAY_MS);
  const before = [...points].reverse().find((p) => p.at <= start);
  const inside = points.filter((p) => p.at > start);
  const steps = [...(before ? [{ at: start, priceCents: before.priceCents }] : []), ...inside];
  if (!steps.length || steps[steps.length - 1]!.priceCents !== currentCents) {
    // No history yet, or the latest change isn't recorded yet: today's price stands from now.
    steps.push({ at: steps.length ? now : start, priceCents: currentCents });
  }
  // Time-weighted average over [first step, now].
  let weighted = 0;
  let span = 0;
  steps.forEach((step, i) => {
    const until = i + 1 < steps.length ? steps[i + 1]!.at : now;
    const ms = Math.max(0, until.getTime() - step.at.getTime());
    weighted += step.priceCents * ms;
    span += ms;
  });
  const prices = steps.map((s) => s.priceCents);
  const typicalCents = span ? Math.round(weighted / span) : currentCents;
  const since30 = new Date(now.getTime() - 30 * DAY_MS);
  const last30 = [
    ...[...points]
      .reverse()
      .filter((p) => p.at <= since30)
      .slice(0, 1),
    ...points.filter((p) => p.at > since30),
  ].map((p) => p.priceCents);
  const changed = new Set(prices).size > 1;
  return {
    days,
    currency,
    points: steps.map((s) => ({ at: s.at.toISOString(), priceCents: s.priceCents })),
    asOf: now.toISOString(),
    currentCents,
    lowestCents: Math.min(...prices),
    highestCents: Math.max(...prices),
    typicalCents,
    lowestIn30Days:
      changed && currentCents < typicalCents && last30.every((p) => currentCents <= p),
    changed,
  };
}
