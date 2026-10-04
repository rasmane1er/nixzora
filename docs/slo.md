# NIXZORA service level objectives

What "working" means for shoppers, measured from the API's own request metrics (ADR-0023).
Rules: `infra/observability/prometheus/rules/slo.yml`. Dashboard: **NIXZORA · Service health**.

| SLO                                            | Objective (30 days)                   | SLI (bad events)                  | Error budget                |
| ---------------------------------------------- | ------------------------------------- | --------------------------------- | --------------------------- |
| [API availability](#apiavailability)           | 99.5% of API requests succeed         | responses with a 5xx status       | 0.5% ≈ 3.6 h of full outage |
| [API latency](#apilatency)                     | 99% of API requests answer within 1 s | requests slower than 1 s          | 1% of requests              |
| [Checkout availability](#checkoutavailability) | 99.9% of checkout requests succeed    | 5xx on `/api/v1/checkout…` routes | 0.1% ≈ 43 min               |

4xx responses (bad input, not signed in, out of stock) are the client's, not ours: they count
as good. Health checks are not measured.

## Alerting: burn rates

Each SLO alerts when its error budget is being spent too fast, checked over a long and a short
window together (the short one stops the alert soon after recovery):

| Severity | Long window | Short window | Burn rate | Budget gone in | What happens                     |
| -------- | ----------- | ------------ | --------- | -------------- | -------------------------------- |
| page     | 1 h         | 5 min        | 14.4×     | ~2 days        | Alarm email now; act immediately |
| page     | 6 h         | 30 min       | 6×        | ~5 days        | Alarm email; act within the hour |
| ticket   | 1 day       | 2 h          | 3×        | ~10 days       | Fix this week                    |
| ticket   | 3 days      | 6 h          | 1×        | 30 days        | Look at the trend                |

## Error budget policy

- **Budget left (dashboard tile) above 50%**: ship as usual.
- **25–50%**: risky changes (migrations, infrastructure) wait for a quiet hour and a second
  review.
- **Below 25%, or a page this week**: reliability work comes first until the budget recovers;
  feature releases need the incident's fix merged.

## ApiAvailability

5xx responses mean a bug or a broken dependency. Start with the **Routes with server errors**
table, then the API logs for that route (every line has a `trace_id`). Database or Redis down?
`GET /api/v1/health` says which. Runbook: [incident response](runbooks/incident-response.md).

## ApiLatency

Look at **Slowest routes**. A single route: its query (RDS Performance Insights) or a slow
dependency (**Dependency latency** on the jobs dashboard). All routes: CPU or event-loop lag
(autoscaling at its maximum?), or the database.

## CheckoutAvailability

Checkout failures cost sales directly. Check Stripe (dependency errors, Stripe status page),
then the database. A payment that succeeded at Stripe but failed here is reconciled by the
webhook; do not refund by hand before checking the order.
