# ADR-0023: Prometheus metrics, Grafana dashboards, SLOs and burn-rate alerts

- Status: Accepted
- Date: 2026-10-06
- Roadmap: p8-07 (Prometheus and Grafana dashboards, SLOs and alerts)
- Builds on: ADR-0007 (logging and tracing), ADR-0017 (worker), ADR-0020 (Kafka), ADR-0022
  (read replica)

## Context

We had logs, traces (OpenTelemetry, off by default) and CloudWatch alarms on load balancer and
database metrics. Nothing measured what shoppers experience per route, nothing tracked the
background jobs over time, and alarms fired on thresholds instead of on how fast we were failing
our own objectives.

## Decision

**Prometheus metrics in every process of the API image** (`prom-client`), served on
`METRICS_PORT` (9464), a port the load balancer never routes to:

| Metric                                                             | What                                                                             |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- |
| `nixzora_http_request_duration_seconds`                            | Histogram by method, route **pattern** (never the raw URL), status class         |
| `nixzora_dependency_request_duration_seconds`                      | Calls to search, AI, Anthropic, Voyage, by outcome (HTTP errors count as errors) |
| `nixzora_business_events_total`                                    | Orders paid / shipped / cancelled / refunded, returns, seller orders             |
| `nixzora_outbox_backlog`, `_failed`, `_last_run_timestamp_seconds` | Delivery and Kafka queues (only where jobs run, so no double count)              |
| `nixzora_db_replica_lag_seconds`, `_usable`                        | The read replica as the API sees it (absent without one)                         |
| `nixzora_process_*`, `nixzora_nodejs_*`                            | CPU, memory, event loop lag, GC                                                  |

Every series carries `service` (api, worker, search, ai).

**SLOs with multi-window, multi-burn-rate alerts** (Google SRE workbook): API availability
99.5%, API latency 99% under 1 s, checkout availability 99.9%, over 30 days. Recording rules
compute each SLI over seven windows; alerts page at 14.4× and 6× burn, and open tickets at 3×
and 1×. Operational alerts cover a stalled or failing outbox, Kafka backlog, replica fallback,
dependency errors, event-loop lag, memory near the limit and targets down. Definitions and the
error budget policy: `docs/slo.md`.

**Two Grafana dashboards**, provisioned from JSON: _Service health_ (SLO tiles with error
budget left, traffic, 5xx ratio, p95/p99 latency, burn rate, slowest and failing routes) and
_Jobs, data and dependencies_ (outbox and Kafka, business events, replica, dependency latency
and errors, event loop and memory). Colors follow the shared chart palette: categorical slots in
fixed order for series, status colors only for thresholds, each beside its label.

**Where it runs.**

- Local: `pnpm obs:up` starts Prometheus, Alertmanager and Grafana (http://localhost:3002)
  next to Jaeger, scraping the apps on the host.
- AWS (`observability = { managed_prometheus = true }`, off by default): an Amazon Managed
  Service for Prometheus workspace loads the same rule files and sends alerts to the existing
  alarm topic (email). An AWS Distro for OpenTelemetry collector next to each API-image task
  scrapes localhost:9464 and remote-writes with the task role (SigV4). Grafana (local, or
  Amazon Managed Grafana if the account uses IAM Identity Center) reads the workspace and
  imports the same dashboards.
- Kubernetes (ADR-0021): pods expose the metrics port with `prometheus.io/*` annotations; the
  network policy lets a Prometheus in the `monitoring` namespace scrape it.

**Checked in CI**: `promtool check config` and `check rules`, `amtool check-config`, dashboard
JSON shape, and a Terraform test with the workspace on.

## Consequences

- Dashboards and alerts speak in shoppers' terms (failed and slow requests, checkout) and in
  error budget, which drives the release policy in `docs/slo.md`.
- Route-pattern labels keep cardinality bounded (one series per route, method and status
  class), so metrics stay cheap.
- The CloudWatch alarms stay: they cover the load balancer, database and Redis from AWS's side,
  even if every task is down.
