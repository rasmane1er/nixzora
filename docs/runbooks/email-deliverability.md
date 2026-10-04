# Runbook: email deliverability

Receipts, password resets and seller notices go out through Amazon SES (p9-02). This page covers
how the sending domain is set up, what happens when mail bounces, and what to do when an alarm
fires.

## How it is set up (Terraform, `email.tf`)

| Piece                          | What it does                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------ |
| DKIM (3 CNAME records)         | Signs every message, proving it comes from our domain                                                  |
| `mail.<domain>` (MX + SPF)     | Bounces return to SES through our own subdomain, so SPF passes for our domain                          |
| DMARC (`_dmarc.<domain>`)      | `p=quarantine`: receivers treat unsigned mail claiming to be us as spam; reports go to the alarm email |
| Configuration set `<env>-mail` | Every message uses it: TLS required, reputation metrics, SES's own suppression list                    |
| SNS topic `<env>-ses-events`   | SES publishes permanent bounces and complaints; SNS posts them to the API                              |
| Alarms                         | Bounce rate above 2%, complaint rate above 0.05% (SES reviews accounts at 5% / 0.1%)                   |

## What the API does with feedback

`POST /api/v1/notifications/webhooks/ses` accepts only SNS messages signed by SNS for our topic.
A **permanent bounce** (the address does not exist) or a **complaint** (the customer pressed
"spam") adds the address to `email_suppressions`. From then on every email to it is skipped,
whatever the kind: sending to dead or unwilling addresses is what gets an account paused.
Temporary bounces (full mailbox, server down) change nothing; SES retries them.

The Ops Center shows it on the customer's page under **Email**: "Stopped: the address bounced"
or "Stopped: marked as spam", with the receiving server's reason. When the customer has fixed
their address (or says the spam report was a mistake), press **Email again** (needs
`users.manage`; audited). If they changed to a new address, nothing is needed: the list is per
address.

## When an alarm fires

1. **Bounce rate.** SES console → Reputation metrics shows the trend. Usually a burst of
   sign-ups with mistyped or fake addresses. Check the newest `email.bounced` entries in the Ops
   Center audit log (one per address). Look for one domain or one sign-up source; block it at
   the WAF if it is abuse.
2. **Complaint rate.** The newest `email.complained` audit entries say which email people mark as
   spam (`template`, e.g. `orders.receipt`). A complaint about a receipt usually means the
   customer did not recognize the sender: check the subject line and From name.
3. If SES pauses sending, emails fail (the API logs "was not delivered" with the reason) and
   queued notifications retry. Answer the SES case in the AWS Support Center with what changed
   and what you fixed.

## Checks

- Send a test to `bounce@simulator.amazonses.com` (from the SES console) and confirm the address
  appears in `email_suppressions` within a minute; `complaint@simulator.amazonses.com` likewise.
  Then remove both rows.
- `dig TXT mail.<domain>` shows the SPF record; `dig TXT _dmarc.<domain>` the DMARC policy.
- If the WAF blocks SNS (its user agent is "Amazon Simple Notification Service Agent"), allow
  the webhook path in the WAF rules.
