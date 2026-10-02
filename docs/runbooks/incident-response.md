# Runbook: something is wrong in production

## First five minutes

1. Acknowledge the alarm email (`nixzora-production-*`). Which alarm?
2. Open CloudWatch → Dashboards/ECS service metrics, and the logs `/nixzora/production/api`.
   Every log line has a `trace_id`; search for it to follow one request.
3. Is it a release? Compare the time with the last **Deploy** run. If yes: roll back
   (see deploy-and-rollback.md) first, investigate second.

## Common alarms

| Alarm           | Likely cause and first action                                                                 |
| --------------- | --------------------------------------------------------------------------------------------- |
| `alb-5xx`       | API errors: check API logs; database or Redis down? `GET /api/v1/health` shows which.         |
| `api-unhealthy` | Tasks crash-looping: logs show the startup error (often a missing/invalid secret).            |
| `alb-latency`   | Slow queries (RDS Performance Insights) or CPU-bound tasks (autoscaling at max?).             |
| `db-cpu`        | Find the top query in Performance Insights; add an index in a migration.                      |
| `db-storage`    | Storage autoscaling hit its cap: raise `db_allocated_storage` and apply.                      |
| `redis-memory`  | Carts are kept 30 days: consider a larger node or shorter TTL.                                |
| `waf-blocks`    | Possible attack or a bot. WAF console → sampled requests. Tighten `waf_rate_limit` if needed. |

## Payments

Stripe dashboard → Developers → Webhooks shows failed deliveries; Stripe retries for 3 days and
NIXZORA ignores duplicates, so fixing the API is enough. Orders stuck in "Awaiting payment" for
paid intents can be resent from the dashboard ("Resend").

## Security incident

Suspected stolen staff account: Ops Center → Customers & staff → suspend (signs out every
device). Suspected key leak: rotate it (rotate-secrets.md). Then read the audit log
(Ops Center → Audit log) for what the account did.
