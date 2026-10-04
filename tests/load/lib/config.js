// Settings for the NIXZORA load tests (docs/performance/load-testing.md).
//   WEB_URL   storefront (server-rendered pages)     default http://localhost:3000
//   API_URL   API                                    default http://localhost:4000
//   PROFILE   smoke | load | stress | spike          default smoke
//   DURATION  steady-state length for "load"         default 5m
//   CHECKOUT  1 to place real (test-payment) orders  default off
//   SCALE     multiplies every journey's rate        default 1 (0.5 = half the traffic)
export const WEB_URL = (__ENV.WEB_URL || 'http://localhost:3000').replace(/\/+$/, '');
export const API_URL = (__ENV.API_URL || 'http://localhost:4000').replace(/\/+$/, '') + '/api/v1';
export const PROFILE = __ENV.PROFILE || 'smoke';
export const CHECKOUT = __ENV.CHECKOUT === '1';
const DURATION = __ENV.DURATION || '5m';
export const SCALE = Number(__ENV.SCALE || 1);
if (!(SCALE > 0)) throw new Error(`SCALE must be a positive number, got "${__ENV.SCALE}"`);

/** Requests per second at the "load" profile's steady state, per journey. */
const RATE = { browse: 8, search: 4, assistant: 1, checkout: 0.5 };

function arrival(rate, stages) {
  return {
    executor: 'ramping-arrival-rate',
    startRate: 0,
    // Per minute: k6 needs whole numbers, and 0.5 checkouts a second is 30 a minute.
    timeUnit: '1m',
    preAllocatedVUs: Math.max(5, Math.ceil(rate * 4)),
    maxVUs: Math.max(20, Math.ceil(rate * 20)),
    stages: stages.map((stage) => ({ ...stage, target: Math.round(stage.target * 60) })),
  };
}

function profileScenarios() {
  const journeys = Object.keys(RATE).filter((name) => name !== 'checkout' || CHECKOUT);
  const scenarios = {};
  for (const journey of journeys) {
    const rate = RATE[journey] * SCALE;
    const shape = {
      smoke: null,
      load: [
        { target: rate, duration: '1m' },
        { target: rate, duration: DURATION },
        { target: 0, duration: '30s' },
      ],
      // Raises the rate until something gives: up to 10x the expected peak.
      stress: [
        { target: rate * 2, duration: '1m' },
        { target: rate * 5, duration: '2m' },
        { target: rate * 10, duration: '2m' },
        { target: 0, duration: '30s' },
      ],
      // A sudden burst (a promotion email going out), then back to normal.
      spike: [
        { target: rate, duration: '1m' },
        { target: rate * 8, duration: '20s' },
        { target: rate * 8, duration: '1m' },
        { target: rate, duration: '20s' },
        { target: rate, duration: '1m' },
      ],
    }[PROFILE];
    scenarios[journey] = shape
      ? { ...arrival(rate, shape), exec: journey }
      : { executor: 'shared-iterations', vus: 1, iterations: 3, exec: journey };
  }
  return scenarios;
}

/**
 * Pass/fail limits from the SLOs (docs/slo.md): under expected load, fewer than 0.5% of requests
 * fail and 99% of API calls answer within 1 s. The stress and spike profiles look for the
 * breaking point, so they report these numbers without failing on them.
 */
function thresholds() {
  const strict = PROFILE === 'smoke' || PROFILE === 'load';
  const t = (expr) => (strict ? [expr] : [{ threshold: expr, abortOnFail: false }]);
  return {
    http_req_failed: t('rate<0.005'),
    checks: t('rate>0.99'),
    'http_req_duration{kind:api}': t('p(99)<1000'),
    'http_req_duration{kind:page}': t('p(95)<1500'),
    'http_req_duration{kind:assistant}': t('p(95)<2500'),
    ...(CHECKOUT ? { 'http_req_duration{kind:checkout}': t('p(95)<1500') } : {}),
  };
}

/** Request names, so the report can break results down per endpoint (always-true thresholds). */
export const NAMES = [
  'home',
  'category',
  'product',
  'related',
  'search',
  'filter',
  'chat',
  'add to cart',
  'place order',
  'pay',
];
function perEndpoint() {
  const out = {};
  for (const name of NAMES) {
    out[`http_req_duration{name:${name}}`] = ['max>=0'];
    out[`http_req_failed{name:${name}}`] = ['rate>=0'];
    out[`http_reqs{name:${name}}`] = ['count>=0'];
  }
  return out;
}

export const options = {
  scenarios: profileScenarios(),
  thresholds: { ...perEndpoint(), ...thresholds() },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  userAgent: 'nixzora-load-test/1.0 (k6)',
};
