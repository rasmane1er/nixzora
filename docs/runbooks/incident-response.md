# Runbook: something is wrong in production

## Who gets told, and how (p9-11)

| Signal                                                                 | Where it goes                                                                                  |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Any CloudWatch alarm (`<env>-*`)                                       | `alarm_email`, plus the on-call phone when `oncall_webhook_url` / `oncall_sms_numbers` are set |
| Store or API down from outside (`<env>-outside-store`, `-outside-api`) | Same, from us-east-1: Route 53 checks the sites from several regions every 30 s                |
| Customers                                                              | `https://status.<domain>`: updated every minute by a probe outside the app                     |

**Phone alerts.** Recommended: a free PagerDuty account → Services → New service → Integrations →
**Amazon CloudWatch** → copy the integration URL into `oncall_webhook_url` in the tfvars file
and apply (the URL is a secret: tfvars only, never git). PagerDuty's app pushes, calls or texts.
Plain SMS (`oncall_sms_numbers`) works too, but US numbers need an approved origination identity
first (AWS End User Messaging → Phone numbers → request a toll-free number, a few days).

**Status page message.** During an incident, say what customers will notice, in plain words:

```sh
aws ssm put-parameter --name /nixzora/production/status-note --type String --overwrite \
  --value "Checkout is failing for some cards. We are working on it. Next update 14:30 UTC."
# when it is over:
aws ssm put-parameter --name /nixzora/production/status-note --type String --overwrite --value "-"
```

It shows on the status page within about a minute.

**Practice.** Once a quarter (and after changing who is on call), run
`ENV=staging scripts/ops/incident-drill.sh` from CloudShell. It trips an alarm (marked as a
drill), checks the page reached you and the status message appears, puts everything back and
writes `docs/incident-drills/<date>-<env>.md`. Commit the report.

## First five minutes

1. Acknowledge the page or alarm email (`nixzora-production-*`). Which alarm?
2. Open CloudWatch → Dashboards/ECS service metrics, and the logs `/nixzora/production/api`.
   Every log line has a `trace_id`; search for it to follow one request.
3. Is it a release? Compare the time with the last **Deploy** run. If yes: roll back
   (see deploy-and-rollback.md) first, investigate second.

## Common alarms

| Alarm                                    | Likely cause and first action                                                                                                                   |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `alb-5xx`                                | API errors: check API logs; database or Redis down? `GET /api/v1/health` shows which.                                                           |
| `api-unhealthy`                          | Tasks crash-looping: logs show the startup error (often a missing/invalid secret).                                                              |
| `alb-latency`                            | Slow queries (RDS Performance Insights) or CPU-bound tasks (autoscaling at max?).                                                               |
| `db-cpu`                                 | Find the top query in Performance Insights; add an index in a migration.                                                                        |
| `db-storage`                             | Storage autoscaling hit its cap: raise `db_allocated_storage` and apply.                                                                        |
| `db-replica-lag`                         | Replica behind (heavy writes or a small instance). Reads already use the primary; raise `db_read_replica.instance_class` if it keeps happening. |
| `redis-memory`                           | Carts are kept 30 days: consider a larger node or shorter TTL.                                                                                  |
| `waf-blocks`                             | Possible attack or a bot. WAF console → sampled requests. Tighten `waf_rate_limit` if needed.                                                   |
| `outside-store` / `outside-api`          | Unreachable from the internet: DNS, certificate, load balancer, or every task down. Check the ALB target health first. Post a status message.   |
| `ses-bounce-rate` / `ses-complaint-rate` | See [email deliverability](email-deliverability.md).                                                                                            |

## Emails or push notifications not arriving

1. `GET /api/v1/health` → `jobs`: `status` "down" means the outbox has not been drained for a
   minute; `backlog` is what is waiting; `failed` counts events that gave up after 10 tries.
   Ops Center shows the same on its dashboard.
2. Worker logs: CloudWatch group `/nixzora/<env>/worker`. A crash-looping worker usually means a
   missing secret or an unreachable database, like the API.
3. Nothing is lost while the worker is down: events wait in `outbox_events` and go out when it
   is back. To get them out sooner, remove `worker` from `services` and apply: the API runs the
   jobs itself again.
4. Failed events: `SELECT type, last_error FROM outbox_events WHERE published_at IS NULL AND
attempts >= 10`. Fix the cause, then `UPDATE … SET attempts = 0` to retry them.

## Payments

Stripe dashboard → Developers → Webhooks shows failed deliveries; Stripe retries for 3 days and
NIXZORA ignores duplicates, so fixing the API is enough. Orders stuck in "Awaiting payment" for
paid intents can be resent from the dashboard ("Resend").

## Security incident

Suspected stolen staff account: Ops Center → Customers & staff → suspend (signs out every
device). Suspected key leak: rotate it (rotate-secrets.md). Then read the audit log
(Ops Center → Audit log) for what the account did.

## Event tables and partitions (ADR-0022)

`audit_logs`, `product_events` and `outbox_events` are split by month (`partitions.<table>_YYYY_MM`).
The worker creates months ahead and drops expired ones daily (log line `Partitions: … created`).

- Rows in a `_default` partition mean a month was missing: run
  `SELECT partitions.ensure_monthly('<table>', now()::date, 3);` after moving those rows out
  (PostgreSQL refuses a new month while `_default` holds rows for it).
- To keep a month longer (an investigation), detach it so maintenance skips it:
  `ALTER TABLE outbox_events DETACH PARTITION partitions.outbox_events_2026_07;`
