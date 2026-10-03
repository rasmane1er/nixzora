# ADR-0017: A notifications worker for the background jobs

- Status: Accepted
- Date: 2026-10-03
- Roadmap: p8-03 (extract the notifications worker)
- Builds on: ADR-0006 (cart and checkout, transactional outbox), ADR-0015 (search service), ADR-0016 (AI service)

## Context

Every API task also ran the background jobs: it drained the transactional outbox every three
seconds (order, shipping, refund and return emails; push notifications; new-order alerts to
sellers; search indexing; review insights), swept expired stock reservations and unpaid orders,
purged old recommendation events and paid sellers. Scaling the API for traffic multiplied the
pollers; a slow SES call or a burst of review summaries competed with checkout requests for the
same event loop; and a deploy of the API restarted every job at once.

## Decision

**A separate worker process** (`apps/api/src/worker-main.ts`, the API image started with
`dist/worker-main.js`) runs all of these jobs. It boots the same Nest modules as the API with
`createApplicationContext`, so the handlers, templates and providers are the same code, but it
opens no HTTP API: only `GET /health` on `WORKER_PORT` (4300) for the container health check.

- **One switch.** `BACKGROUND_JOBS` (default `true`) decides whether a process runs the timers
  and start-up passes. The worker forces it on; Terraform sets it to `false` on the API when the
  `worker` service is enabled. Development, tests and single-task deployments keep everything
  in one process, as before.
- **Safe to run several.** Outbox rows are claimed with `FOR UPDATE SKIP LOCKED`, so two
  workers (or a worker and an API still running the old task definition during a deploy) never
  send the same email twice. The service autoscales on CPU like the others.
- **Same permissions as the API.** The worker uses the API's task role (SES, S3) and secrets,
  and reaches the search and AI services the same way. It has no load balancer, service name or
  ingress rule: nothing calls it.
- **Visible.** Each drain stamps Redis; `GET /api/v1/health` reports `jobs` (where they run,
  last run, events waiting, events that failed every retry). The report is informational: a
  stalled worker never takes the API out of its load balancer. Ops Center shows "Notifications
  waiting" on the dashboard (red when stalled or when events failed) and the public status page
  shows "Emails and notifications".
- **Graceful stops.** ECS gives the task 60 s to stop, so a batch being delivered finishes.

## Consequences

- API tasks only answer requests; adding API tasks no longer adds pollers.
- One more small Fargate service (256 CPU / 512 MB on staging); remove `worker` from
  `services` to go back to in-process jobs.
- Customers see no change: the same emails and pushes, on the website and in the app. A worker
  outage delays them (they wait in the outbox) instead of losing them.
- Kafka (p8-04) can replace the outbox poller inside the worker without touching the API.
