# Runbook: fraud reviews

Design: [ADR-0024](../adr/0024-fraud-signals.md). Where: **Ops Center → Fraud reviews**
(permission `risk.review`: support and admin).

## Daily review

Open the **To review** tab once a day at least (oldest first). Each card says what was held,
the score and every signal behind it, in words.

### A held order

- **Check:** does the shipping name match the email? Is the address a freight forwarder or a
  hotel? Several orders to the same address from different emails (search Orders)? If in doubt,
  email the customer from the order page and wait a day.
- **Clear:** the order can ship; its stores get an email saying so.
- **Confirm fraud:** the order is cancelled and refunded in full, and its email, account and IP
  are declined from now on.

### A chargeback

- **Check:** Stripe dashboard → Payments → Disputes for the reason and the deadline to respond.
  Gather the tracking and delivery proof from the order page and submit it in Stripe.
- **Clear** after answering the dispute (the store's payout review is separate).
- **Confirm fraud** when the card was stolen: future checkouts from that email, account and IP
  are declined.

### Paused store payouts

- **Check:** the store's orders. Are the buyers its own members? Are refunds or chargebacks
  recent? Did sales jump right before the first payout?
- **Clear:** payouts restart with the next daily run; the store gets an email.
- **Confirm fraud:** payouts stay paused. Suspend the store from Sellers if it is clearly
  fraudulent, and talk to finance about money already paid out.

Write a note on what you checked: it is shown on the card and kept in the audit log.

## Many declined checkouts

The `CheckoutDeclinesSpike` alert, or a support ticket from a shopper who was declined.

1. **Declined at checkout** tab: are they from a few IPs with many emails and failed payments?
   That is card testing, and declining is working. If it keeps up, add a WAF rate rule for the
   checkout route and check Stripe's own card-testing protection is on.
2. Are they real shoppers (different IPs, ordinary amounts, one signal each)? A rule is too strict:
   switch to `RISK_CHECKS=shadow` on the API service (one setting, rolls the tasks), find the
   rule in `apps/api/src/modules/risk/risk-rules.ts`, adjust its points with a test, deploy, and
   go back to `enforce`.
3. A single shopper declined by mistake: there is no allowlist on purpose. If they were tied to
   confirmed fraud by a shared IP (an office, a university), clear that old review instead: open
   it from the Confirmed fraud tab and review it again as clear.

## Settings

| Setting             | Default   | Meaning                                                           |
| ------------------- | --------- | ----------------------------------------------------------------- |
| `RISK_CHECKS`       | `enforce` | `shadow` records scores without declining or holding; `off` skips |
| `RISK_REVIEW_SCORE` | 50        | From this score an order or payout waits for a person             |
| `RISK_BLOCK_SCORE`  | 80        | From this score a checkout is declined (must be above review)     |

Load tests send hundreds of orders from one IP: run them with `RISK_CHECKS=shadow`
([load testing](../performance/load-testing.md)).

## Stripe

The webhook endpoint must include `charge.dispute.created` besides `payment_intent.*`
([first deploy](first-deploy.md)). Stripe Radar's risk level on each card payment is read after
the payment succeeds; a Stripe outage there never blocks an order (the check is skipped and
logged).
