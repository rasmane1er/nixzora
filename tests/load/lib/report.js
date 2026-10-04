import { NAMES } from './config.js';

const ms = (v) =>
  v === undefined ? '–' : v < 1000 ? `${Math.round(v)} ms` : `${(v / 1000).toFixed(2)} s`;
const pct = (v) => (v === undefined ? '–' : `${(v * 100).toFixed(2)}%`);

/** Markdown (results/<profile>-<time>.md), raw JSON, and a short text summary on stdout. */
export function report(summary, context) {
  const m = summary.metrics;
  const seconds = summary.state.testRunDurationMs / 1000;
  const rows = NAMES.filter((name) => m[`http_reqs{name:${name}}`]?.values.count).map((name) => {
    const d = m[`http_req_duration{name:${name}}`].values;
    const count = m[`http_reqs{name:${name}}`].values.count;
    return `| ${name} | ${count} | ${(count / seconds).toFixed(1)} | ${pct(m[`http_req_failed{name:${name}}`].values.rate)} | ${ms(d.med)} | ${ms(d['p(95)'])} | ${ms(d['p(99)'])} | ${ms(d.max)} |`;
  });
  const limits = Object.entries(m)
    .filter(([, metric]) => metric.thresholds)
    .flatMap(([name, metric]) =>
      Object.entries(metric.thresholds)
        .filter(([expr]) => !/^(max>=0|rate>=0|count>=0)$/.test(expr))
        .map(
          ([expr, result]) => `| \`${name}\` | \`${expr}\` | ${result.ok ? 'pass' : '**fail**'} |`,
        ),
    );
  const total = m.http_reqs?.values;
  const md = `# Load test: ${context.profile}

- When: ${new Date().toISOString()}
- Storefront: ${context.web} · API: ${context.api} · Checkout journeys: ${context.checkout ? 'on' : 'off'} · Rate: ×${context.scale}
- Duration: ${seconds.toFixed(0)} s · Requests: ${total?.count ?? 0} (${(total?.rate ?? 0).toFixed(1)}/s) · Failed: ${pct(m.http_req_failed?.values.rate)} · Checks: ${pct(m.checks?.values.rate)}
- Peak virtual users: ${m.vus_max?.values.max ?? '–'} · Dropped iterations (not enough VUs): ${m.dropped_iterations?.values.count ?? 0}

## Per endpoint

| Request | Count | Per second | Failed | Median | p95 | p99 | Max |
| ------- | ----: | ---------: | -----: | -----: | --: | --: | --: |
${rows.join('\n')}

## Limits (SLOs)

| Metric | Limit | Result |
| ------ | ----- | ------ |
${limits.join('\n')}
`;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const text = `\n${context.profile}: ${total?.count ?? 0} requests, ${pct(m.http_req_failed?.values.rate)} failed, API p99 ${ms(m['http_req_duration{kind:api}']?.values['p(99)'])}, pages p95 ${ms(m['http_req_duration{kind:page}']?.values['p(95)'])}\n${limits.length ? limits.map((l) => l.replace(/`/g, '')).join('\n') : ''}\n`;
  return {
    stdout: text,
    [`tests/load/results/${context.profile}-${stamp}.md`]: md,
    [`tests/load/results/${context.profile}-${stamp}.json`]: JSON.stringify(summary, null, 2),
  };
}
