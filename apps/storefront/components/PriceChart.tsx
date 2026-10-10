'use client';

import { type PriceHistory } from '@nixzora/validation';
import { useEffect, useId, useRef, useState } from 'react';

const H = 180;
const PAD = { top: 12, right: 12, bottom: 22, left: 56 };

/**
 * Price history (p10-19): one series, drawn as steps (a price holds until it changes), with a
 * crosshair and tooltip on hover or keyboard, a recessive grid, and the changes as a table.
 */
export function PriceChart({
  history,
  labels,
  locale,
}: {
  history: PriceHistory;
  labels: {
    chartLabel: string;
    tableSummary: string;
    colDate: string;
    colPrice: string;
    today: string;
  };
  locale: string;
}) {
  const id = useId();
  // Drawn at the plot's real width, so text and lines stay the same size on any screen.
  const plotRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(640);
  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;
    const measure = () => setW(Math.max(240, Math.round(el.clientWidth)));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const money = new Intl.NumberFormat(locale, { style: 'currency', currency: history.currency });
  const day = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const fmt = (cents: number) => money.format(cents / 100);
  const start = Date.parse(history.points[0]!.at);
  const end = Date.parse(history.asOf);
  const lo = history.lowestCents;
  const hi = history.highestCents;
  // Some headroom so a flat line doesn't sit on the frame.
  const pad = Math.max(1, Math.round((hi - lo) * 0.15) || Math.round(hi * 0.05));
  const yMin = Math.max(0, lo - pad);
  const yMax = hi + pad;
  const x = (t: number) =>
    PAD.left + ((t - start) / Math.max(1, end - start)) * (W - PAD.left - PAD.right);
  const y = (c: number) =>
    PAD.top + (1 - (c - yMin) / Math.max(1, yMax - yMin)) * (H - PAD.top - PAD.bottom);
  const steps = history.points.map((p) => ({ t: Date.parse(p.at), c: p.priceCents }));
  let d = '';
  steps.forEach((s, i) => {
    const next = i + 1 < steps.length ? steps[i + 1]!.t : end;
    d += `${i ? 'L' : 'M'}${x(s.t).toFixed(1)},${y(s.c).toFixed(1)}H${x(next).toFixed(1)}`;
  });
  const ticks = [yMin, (yMin + yMax) / 2, yMax].map((c) => Math.round(c));
  const [hover, setHover] = useState<number | null>(null);
  const at = hover ?? null;
  const priceAt = (t: number) => [...steps].reverse().find((s) => s.t <= t)?.c ?? steps[0]!.c;

  const pick = (clientX: number, rect: DOMRect) => {
    const px = ((clientX - rect.left) / rect.width) * W;
    const t = start + ((px - PAD.left) / (W - PAD.left - PAD.right)) * (end - start);
    setHover(Math.min(end, Math.max(start, t)));
  };

  const summary = labels.chartLabel;
  return (
    <figure className="price-chart">
      <div className="price-chart__plot" ref={plotRef}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width={W}
          height={H}
          role="img"
          aria-labelledby={`${id}-desc`}
          tabIndex={0}
          onMouseMove={(e) => pick(e.clientX, e.currentTarget.getBoundingClientRect())}
          onMouseLeave={() => setHover(null)}
          onTouchStart={(e) => pick(e.touches[0]!.clientX, e.currentTarget.getBoundingClientRect())}
          onTouchMove={(e) => pick(e.touches[0]!.clientX, e.currentTarget.getBoundingClientRect())}
          onKeyDown={(e) => {
            const stepMs = (end - start) / 30;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
              e.preventDefault();
              const from = at ?? end;
              setHover(
                Math.min(end, Math.max(start, from + (e.key === 'ArrowRight' ? stepMs : -stepMs))),
              );
            } else if (e.key === 'Escape') setHover(null);
          }}
          onBlur={() => setHover(null)}
        >
          <desc id={`${id}-desc`}>{summary}</desc>
          {ticks.map((c) => (
            <g key={c} className="price-chart__grid">
              <line x1={PAD.left} x2={W - PAD.right} y1={y(c)} y2={y(c)} />
              <text x={PAD.left - 8} y={y(c) + 4} textAnchor="end">
                {fmt(c)}
              </text>
            </g>
          ))}
          <text className="price-chart__axis" x={PAD.left} y={H - 4}>
            {day.format(new Date(start))}
          </text>
          <text className="price-chart__axis" x={W - PAD.right} y={H - 4} textAnchor="end">
            {labels.today}
          </text>
          <path className="price-chart__line" d={d} />
          <circle className="price-chart__dot" cx={x(end)} cy={y(history.currentCents)} r={4} />
          {at !== null ? (
            <g className="price-chart__cross">
              <line x1={x(at)} x2={x(at)} y1={PAD.top} y2={H - PAD.bottom} />
              <circle cx={x(at)} cy={y(priceAt(at))} r={4} />
            </g>
          ) : null}
        </svg>
        {at !== null ? (
          <div className="price-chart__tip" role="status" style={{ left: `${(x(at) / W) * 100}%` }}>
            <strong>{fmt(priceAt(at))}</strong>
            <span>{day.format(new Date(at))}</span>
          </div>
        ) : null}
      </div>
      <details className="price-chart__table">
        <summary>{labels.tableSummary}</summary>
        <table className="plain">
          <thead>
            <tr>
              <th>{labels.colDate}</th>
              <th>{labels.colPrice}</th>
            </tr>
          </thead>
          <tbody>
            {history.points.map((p) => (
              <tr key={p.at}>
                <td>{day.format(new Date(p.at))}</td>
                <td>{fmt(p.priceCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
