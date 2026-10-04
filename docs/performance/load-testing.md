# Load testing with k6

The scripts in `tests/load` replay what shoppers do, at a set arrival rate, and fail when an SLO
from [docs/slo.md](../slo.md) is missed. Latest findings:
[load-test-report-2026-10.md](load-test-report-2026-10.md).

## Journeys

Each journey is its own k6 scenario with its own arrival rate, so a slow page does not slow down
the traffic sent to the API (open model: requests keep arriving, like real shoppers).

| Journey     | Requests                                                           | Rate at `load` |
| ----------- | ------------------------------------------------------------------ | -------------: |
| `browse`    | home page, a category page, a product page, related products (API) |          8 / s |
| `search`    | a catalog search, then a category filtered and sorted by price     |          4 / s |
| `assistant` | one question to the shopping assistant                             |          1 / s |
| `checkout`  | guest checkout: add to cart, place the order, pay (`CHECKOUT=1`)   |        0.5 / s |

Pages are tagged `kind:page`, API calls `kind:api`, the assistant `kind:assistant` and checkout
`kind:checkout`; each request also has a `name` (home, product, place order…) for the per-endpoint
table in the report.

## Profiles

| `PROFILE` | Shape                                                    | Use it for                          |
| --------- | -------------------------------------------------------- | ----------------------------------- |
| `smoke`   | 3 iterations of each journey, 1 user                     | Checking the script and the target  |
| `load`    | 1 min ramp, `DURATION` (default 5 min) at the rate above | Expected peak; must pass every SLO  |
| `stress`  | 2×, 5×, then 10× the rate (5 min)                        | Finding where it breaks, and how    |
| `spike`   | 1×, a jump to 8× for 1 min, back to 1×                   | A promotion email; does it recover? |

## Limits (thresholds)

| Metric                              | Limit        | From                                |
| ----------------------------------- | ------------ | ----------------------------------- |
| `http_req_failed`                   | under 0.5%   | API availability 99.5%              |
| `http_req_duration{kind:api}`       | p99 under 1s | API latency 99% within 1 s          |
| `http_req_duration{kind:checkout}`  | p95 1.5 s    | Checkout must stay quick            |
| `http_req_duration{kind:page}`      | p95 1.5 s    | Server-rendered pages               |
| `http_req_duration{kind:assistant}` | p95 2.5 s    | The assistant (fake model locally)  |
| `checks`                            | over 99%     | Responses have the expected content |

`load` must pass all of them. `stress` and `spike` are expected to miss some (k6 then exits
with code 99, but never stops early): what matters is where, at what rate, and whether errors
appear (they should not: slow is better than broken).

## Running locally

```sh
# Once: k6 (https://grafana.com/docs/k6/latest/set-up/install-k6/), then the stack
pnpm --filter @nixzora/api build && pnpm --filter @nixzora/storefront build
# API with the fake payment provider, no rate limit, and fraud checks recording only:
# all traffic comes from one IP, which is exactly what card testing looks like
RATE_LIMIT_ENABLED=false RISK_CHECKS=shadow PAYMENTS_PROVIDER=fake node apps/api/dist/main.js
pnpm --filter @nixzora/storefront start

export K6_NO_USAGE_REPORT=true   # k6 otherwise reports anonymous usage to Grafana
PROFILE=smoke k6 run tests/load/shop.js
PROFILE=load CHECKOUT=1 k6 run tests/load/shop.js
```

| Variable   | Default                 | Meaning                                          |
| ---------- | ----------------------- | ------------------------------------------------ |
| `WEB_URL`  | `http://localhost:3000` | Storefront                                       |
| `API_URL`  | `http://localhost:4000` | API (without `/api/v1`)                          |
| `PROFILE`  | `smoke`                 | See above                                        |
| `DURATION` | `5m`                    | Steady state of `load`                           |
| `CHECKOUT` | off                     | `1` places guest orders (fake payment provider)  |
| `SCALE`    | `1`                     | Multiplies every rate (`0.5` = half the traffic) |

Measure production builds (`next start`, `node dist/main.js`), never dev servers. Checkout runs
use stock: raise `on_hand` on the demo products first, or orders fail with "out of stock".

Each run writes `tests/load/results/<profile>-<time>.md` (the tables) and `.json` (k6's full
summary). They are git-ignored; copy the ones worth keeping into a report here.

While a run is going, watch **NIXZORA · Service health** in Grafana (`pnpm obs:up`, ADR-0023):
the burn-rate panel shows what the run would cost in error budget.

## Running against staging

From GitHub: **Actions → Load test → Run workflow**, pick a profile. The job uses the staging
environment's `STOREFRONT_URL` and `API_URL`, uploads the results as an artifact and puts the
tables in the job summary. Production is not offered.

Before anything bigger than `smoke`:

1. **Rate limits.** The API allows 120 requests a minute per IP, and the runner is one IP: a
   `load` run gets mostly 429s. Set `RATE_LIMIT_ENABLED=false` on the staging API service for the
   run and turn it back on after (or use k6 Cloud, whose load zones spread the source IPs).
   With `CHECKOUT=1`, also set `RISK_CHECKS=shadow`: hundreds of orders from one IP is what card
   testing looks like, and the fraud checks (ADR-0024) would decline them.
2. **WAF.** If the staging WAF rate rule is on, it blocks the runner too; raise it for the run.
3. **Payments.** The checkout journey pays through the fake provider's confirm endpoint, so
   `CHECKOUT=1` only works where `PAYMENTS_PROVIDER=fake`. Leave it off on a Stripe environment.
4. **Size.** `load` sends about 24 page views a second. Staging's storefront (0.25 vCPU, at most
   2 tasks) tops out near 20 (see the report), so run with `SCALE=0.5`, or raise the storefront
   to 512 CPU and 4 tasks for the run. Production's defaults are sized for `load` at ×1.
5. **Cost and people.** Staging autoscaling adds tasks; tell whoever is using staging, and
   check the tasks scaled back in afterwards.
