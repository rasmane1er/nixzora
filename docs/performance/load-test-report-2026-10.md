# Load test report, October 2026

- Roadmap: p8-08 (k6 load tests and performance report)
- Scripts and how to run them: [load-testing.md](load-testing.md)
- Raw k6 summaries: the `tests/load/results` files named in each section (kept out of git; the
  tables below are copied from them)

## Summary

- **At the expected peak (`load`), everything passes with a wide margin**: 0 failed requests,
  pages p95 under 50 ms, API p99 under 60 ms, checkout p95 under 50 ms.
- **Nothing failed under any profile.** At up to 10× the expected traffic, not one request
  returned an error; requests got slower instead.
- **The API is not the limit.** At 10× it kept its p99 under 330 ms (SLO: 1 s), with event-loop
  lag around 18 ms.
- **Server-rendered pages are the limit.** One storefront process tops out at about 30–45 pages a
  second, depending on the page mix; past that, pages queue and the home page's tail reaches tens
  of seconds.
- **One fix, found by profiling, cut the home page's CPU by about a fifth and its median under
  heavy load from 2.06 s to 67 ms:** formatters (`Intl.NumberFormat`) were created for every
  price on every render; they are now cached.
- **Capacity:** production's default storefront (2 × 0.5 vCPU, up to 6 tasks) handles the
  expected peak at ×1; staging's (0.25 vCPU, up to 2) does not, so staging runs use `SCALE=0.5`.

## Setup

Everything on one machine: 2 vCPUs, PostgreSQL 16, Redis 7, the API (`node dist/main.js`, one
process, fake payment provider, rate limit off), the storefront (`next start`, one process) and
k6 itself. The catalog is the demo seed (all departments, every product with variants). Search
runs inside the API; the assistant uses the fake model, so its numbers measure our code, not
Anthropic's.

This box is a stand-in, not production: the processes compete for the same two CPUs, there is no
load balancer, CDN or network between them. Absolute numbers will differ on AWS; the ratios (what
saturates first, how much CPU a page costs) carry over.

## Results

### Expected peak: `load` (×1, with checkout)

8 browse journeys, 4 searches, 1 assistant question and 0.5 checkouts a second; 270 s
(3 min steady state). 9,558 requests (35.4/s), **0 failed**, all checks passed, every SLO threshold passed.

| Request     | Per second | Median |   p95 |   p99 |    Max |
| ----------- | ---------: | -----: | ----: | ----: | -----: |
| home        |        6.7 |  30 ms | 47 ms | 63 ms |  97 ms |
| category    |        6.7 |  17 ms | 27 ms | 42 ms |  79 ms |
| product     |        6.7 |  18 ms | 31 ms | 50 ms |  89 ms |
| related     |        6.7 |  10 ms | 16 ms | 25 ms |  90 ms |
| search      |        3.3 |  16 ms | 28 ms | 33 ms |  42 ms |
| filter      |        3.3 |   9 ms | 18 ms | 23 ms |  47 ms |
| chat        |        0.8 |  36 ms | 50 ms | 59 ms |  71 ms |
| add to cart |        0.4 |  30 ms | 42 ms | 49 ms |  55 ms |
| place order |        0.4 |  28 ms | 49 ms | 54 ms | 112 ms |
| pay         |        0.4 |  18 ms | 32 ms | 51 ms |  61 ms |

`load-2026-10-04T03-18-41`, after the formatter fix. The run before it
(`load-2026-10-04T02-38-31`) also passed everything; at this rate the fix shows mostly in the
tail (home max 125 → 97 ms, product max 258 → 89 ms).

### Breaking point: `stress` (2× → 5× → 10×)

At 10× the browse journey asks for 240 server-rendered pages a second, well past what one
process can render, so k6 ran out of its 160 virtual users per journey and skipped iterations
(about 8,700). The **API kept up**: search p99 147 ms, checkout p99 under 240 ms.

| Request     | Per second | Median before → after fix | p95 after | p99 after | Failed |
| ----------- | ---------: | ------------------------: | --------: | --------: | -----: |
| home        |       10.5 |           5.51 s → 5.23 s |    7.87 s |   13.00 s |     0% |
| category    |       10.5 |           4.16 s → 3.92 s |    5.61 s |    5.85 s |     0% |
| product     |       10.5 |           4.15 s → 3.95 s |    5.65 s |    5.95 s |     0% |
| related     |       10.5 |                     56 ms |    172 ms |    232 ms |     0% |
| search      |       18.3 |                     14 ms |     86 ms |    147 ms |     0% |
| place order |        2.3 |                     40 ms |    162 ms |    237 ms |     0% |

`stress-2026-10-04T02-44-14` (before), `stress-2026-10-04T03-08-56` (after). Pages miss their
1.5 s p95; nothing else does. In total the box served about 31 pages a second plus 60 API
requests a second, with k6 on the same CPUs. The fix barely moves this run: past saturation
the page queue, not CPU per page, decides latency.

### Burst: `spike` (×1, a jump to ×8 for a minute, back to ×1)

| Request  | Median before → after | p95 after | p99 after | Max after |
| -------- | --------------------: | --------: | --------: | --------: |
| home     |       3.40 s → 3.14 s |    6.72 s |   35.74 s |   48.79 s |
| category |       2.40 s → 2.31 s |    4.37 s |    4.61 s |    4.69 s |
| product  |       2.27 s → 2.25 s |    4.38 s |    4.63 s |    4.88 s |
| search   |                 16 ms |     71 ms |    118 ms |    186 ms |

`spike-2026-10-04T02-54-13` (before), `spike-2026-10-04T03-12-37` (after). No errors at any
point, and the API stayed fast throughout. k6's summary covers the whole run, so how quickly
pages recover after the burst is not in these numbers: watch the latency panels in Grafana during
the next spike run (follow-up below).

## Finding the bottleneck

1. **Not connections.** k6's connection time stayed under 65 ms even at the peak; requests waited
   inside the storefront, not at the socket.
2. **One page type at a time, at 40 a second:** product pages had a median of 19 ms; the home
   page **2.06 s**. Something in the home page was expensive.
3. **CPU per page** (storefront + the API calls it makes): home 27 ms + 7 ms, category 19 ms,
   product 18 ms. The home page renders the most product cards (featured, deals, picks for you).
4. **A CPU profile of the storefront under load** showed the time in `new Intl.NumberFormat`:
   every price, rating and percentage built a new formatter, and building one (locale data
   lookup) costs far more than using one.
5. **Fix:** `@nixzora/i18n` caches formatters by locale and options (`numberFormat`,
   `dateFormat`, `plurals` in `packages/i18n/src/intl.ts`), and `translate` and the formatters use
   them; `@nixzora/ui` caches its currency formats. The product card and the home page also load
   their translations, locale and wishlist in parallel instead of one after another.

| Home page, alone, 40 a second | Before |  After |
| ----------------------------- | -----: | -----: |
| Storefront CPU per page       |  27 ms |  22 ms |
| Median                        | 2.06 s |  67 ms |
| p95                           |      – | 380 ms |
| p99                           |      – | 435 ms |
| Max                           |      – | 547 ms |

After the fix, the home page alone saturates between 40 and 50 a second (at 50: median 3.59 s;
at 60: median 3.74 s, p95 40 s), which matches 22 ms of CPU per page on one core with the API
and k6 beside it.

The home page also has the longest tail of any page under saturation (p99 13–36 s, against 6 s
for category and product pages). The API calls it makes stay fast, so the wait is inside the
storefront process; we have not yet found why one page type waits longer than the others in the
same queue. It only appears past saturation, which autoscaling is there to prevent; it is listed
as a follow-up.

## Capacity

From about 22 ms of CPU per home page (category and product pages: about 19 ms), one vCPU renders
about 45 pages a second at 100% CPU. ECS scales the storefront out at 60% average CPU.

| Environment | Storefront task   | Tasks | Pages/s per task at 60% CPU | Pages/s at max tasks (60%) |
| ----------- | ----------------- | ----: | --------------------------: | -------------------------: |
| Staging     | 0.25 vCPU, 0.5 GB |   1–2 |                         ~ 7 |                       ~ 14 |
| Production  | 0.5 vCPU, 1 GB    |   2–6 |                        ~ 13 |                       ~ 80 |

The `load` profile is about 24 page views a second (8 browse journeys × 3 pages).

- **Production defaults are enough for the expected peak**: two tasks carry ~26 pages a second
  at the scaling target, and six carry ~80, more than 3× the peak. Keep `desired_count = 2`
  (one per zone) and `cpu = 512`.
- **Before a promotion or a launch**, raise the storefront's `max_count` to 10 and its
  `desired_count` to 4 for the day: ECS takes a few minutes to add tasks, longer than a spike
  takes to arrive.
- **Staging is not sized for the `load` profile**: test it with `SCALE=0.5`, or raise its
  storefront to 512 CPU and 4 tasks for the run.
- **The API has headroom**: at 10× it stayed within its SLOs on a single process sharing CPUs
  with everything else. Its production default (2–6 × 0.5 vCPU) needs no change.
- **Stock**: the checkout journey buys real (test) stock. Locally, `on_hand` was raised to
  10,000 on the demo products first.

## Follow-ups

| What                                                                                           | Why                                                         |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Cache the anonymous home page (CloudFront, short TTL, bypassed when signed in)                 | Most home views are anonymous; they would skip rendering    |
| Cache the anonymous "popular" recommendations in Redis for a minute                            | 7 ms of API CPU per home page, the same answer for everyone |
| Find why the home page's tail is longer than other pages' under saturation                     | Only past saturation, but it is the worst latency we saw    |
| Run `load` with `SCALE=0.5` on staging, then on production before launch (rate limits relaxed) | Real network, CDN, load balancer and Fargate CPUs           |
| Time the recovery after a `spike` on the Grafana latency panels                                | The summary cannot show how fast pages recover              |
| Add a `load` smoke run to the release checklist for big releases                               | Catch the next per-render cost before shoppers do           |
