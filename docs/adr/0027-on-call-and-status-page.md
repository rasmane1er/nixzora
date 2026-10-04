# ADR-0027: On-call paging and a public status page

- Status: Accepted
- Date: 2026-10-04
- Roadmap: p9-11 (on-call, status page, practice incident)
- Builds on: ADR-0023 (metrics and SLOs), the incident-response runbook

## Context

Alarms went to one email address. Email is read hours later, and every alarm came from inside
the system it was watching: if the load balancer, the region's CloudWatch or the account itself
had a problem, nothing would say so. Shoppers had no way to tell whether NIXZORA was down or
their connection was, so the first sign of an outage would be support mail.

## Decision

1. **Paging.** The alarms topic can deliver to a pager webhook (`oncall_webhook_url`, PagerDuty
   or Opsgenie, recommended) and to phone numbers by SMS (`oncall_sms_numbers`). Both are off
   until set, so staging stays email-only.
2. **Outside checks.** Route 53 health checks call the storefront and `/health` from several
   regions every 30 seconds. Their alarms live in us-east-1 (where Route 53 publishes metrics)
   on their own topic, subscribed to the same pager, phones and email.
3. **Status page** at `status.<domain>`: a static page in its own S3 bucket behind its own
   CloudFront distribution. A small Lambda runs every minute, checks the store and the API, and
   writes `status.json` (90 days of per-day tallies, plus a note staff set in SSM
   `/nixzora/<env>/status-note`). It shares nothing with the app at run time, so it stays up
   when the app is down; the page says "cannot confirm" when the data is over 5 minutes old.
4. **Practice.** `scripts/ops/incident-drill.sh` trips the 5xx alarm on purpose, sets a status
   note, waits for the people on call to acknowledge, restores everything and writes a report
   to `docs/incident-drills/`.

## Consequences

- A few dollars a month (two health checks, a per-minute Lambda, a small bucket).
- SMS in the US needs a registered origination number (toll-free verification) before AWS
  delivers it; the pager webhook has no such wait, which is why it is recommended.
- The page shows only "working, slow, not working" for two components. Incident text is
  written by a person, never generated from logs.
