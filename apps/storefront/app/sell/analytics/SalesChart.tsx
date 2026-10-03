'use client';

import { useEffect, useRef, useState } from 'react';

type Day = { date: string; salesCents: number; orders: number };

const H = 220;
const PAD = { top: 12, right: 8, bottom: 26, left: 56 };

const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

/** Rounds up to a clean number (…, 600, 800, 1,000, 1,200, …) so the axis ticks read well. */
function niceMax(value: number): number {
  if (value <= 0) return 100_00;
  const exp = 10 ** Math.floor(Math.log10(value));
  return STEPS.find((step) => step * exp >= value)! * exp;
}

/** The element's width in CSS pixels, so text and bars are drawn at true size. */
function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(280, Math.round(entry.contentRect.width)));
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

const dollars = (cents: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);

const shortDate = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${iso}T00:00:00Z`),
  );

/**
 * Daily sales as columns: one series in the brand orange, 4px rounded tops on a single baseline,
 * a hairline grid, a tooltip per day on hover, and the same numbers in a table below.
 */
export function SalesChart({ daily }: { daily: Day[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const [ref, width] = useWidth(760);
  const max = niceMax(Math.max(...daily.map((d) => d.salesCents)));
  const plotW = width - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const band = plotW / daily.length;
  const barW = Math.max(2, Math.min(24, band - 2)); // ≤ 24px, 2px surface gap between neighbours
  const y = (cents: number) => PAD.top + plotH - (cents / max) * plotH;
  const ticks = [0, max / 2, max];
  // About one date label per 90px, always including the last day.
  const labelEvery = Math.max(1, Math.ceil(daily.length / Math.max(2, Math.floor(plotW / 90))));
  const total = daily.reduce((sum, d) => sum + d.salesCents, 0);
  const active = hover === null ? null : daily[hover];

  return (
    <figure className="sales-chart">
      <div className="sales-chart__plot" ref={ref}>
        <svg
          width={width}
          height={H}
          viewBox={`0 0 ${width} ${H}`}
          role="img"
          aria-label={`Daily sales over ${daily.length} days, ${dollars(total)} in total. The table below lists each day.`}
          onPointerLeave={() => setHover(null)}
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={y(tick)}
                y2={y(tick)}
                className="sales-chart__grid"
              />
              <text
                x={PAD.left - 8}
                y={y(tick)}
                dy="0.32em"
                textAnchor="end"
                className="sales-chart__tick"
              >
                {dollars(tick)}
              </text>
            </g>
          ))}
          {daily.map((day, i) => {
            const cx = PAD.left + band * i + band / 2;
            const top = y(day.salesCents);
            const h = PAD.top + plotH - top;
            const r = Math.min(4, h, barW / 2);
            const x0 = cx - barW / 2;
            const x1 = cx + barW / 2;
            const base = PAD.top + plotH;
            return (
              <g key={day.date}>
                {h > 0 ? (
                  <path
                    className="sales-chart__bar"
                    data-active={hover === i || undefined}
                    d={`M${x0},${base} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x1 - r} Q${x1},${top} ${x1},${top + r} V${base} Z`}
                  />
                ) : null}
                {/* The whole day's band is the hit target, bigger than the bar. */}
                <rect
                  x={PAD.left + band * i}
                  y={PAD.top}
                  width={band}
                  height={plotH}
                  fill="transparent"
                  onPointerEnter={() => setHover(i)}
                  onPointerMove={() => setHover(i)}
                />
                {(daily.length - 1 - i) % labelEvery === 0 ? (
                  <text x={cx} y={H - 8} textAnchor="middle" className="sales-chart__tick">
                    {shortDate(day.date)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>
        {active && hover !== null ? (
          <div
            className="sales-chart__tip"
            // Kept inside the card: anchored left near the start, right near the end.
            style={(() => {
              const x = PAD.left + band * hover + band / 2;
              if (x > width - 90) return { right: 0 };
              if (x < 90) return { left: 0 };
              return { left: x, transform: 'translateX(-50%)' };
            })()}
            role="status"
          >
            <strong>{dollars(active.salesCents)}</strong>
            <span>
              {active.orders} {active.orders === 1 ? 'order' : 'orders'} · {shortDate(active.date)}
            </span>
          </div>
        ) : null}
      </div>
      <details className="sales-chart__table">
        <summary>Show as a table</summary>
        <table className="plain">
          <thead>
            <tr>
              <th>Day</th>
              <th className="num">Orders</th>
              <th className="num">Sales</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((day) => (
              <tr key={day.date}>
                <td>{shortDate(day.date)}</td>
                <td className="num">{day.orders}</td>
                <td className="num">{dollars(day.salesCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
