# ADR-0024: Fraud signals on checkout and payouts

- Status: Accepted
- Date: 2026-10-07
- Roadmap: p8-09 (fraud signals on checkout and payouts)
- Builds on: ADR-0003 (payments provider interface), ADR-0006 (outbox), ADR-0012 and ADR-0014
  (marketplace payouts), ADR-0023 (metrics)

## Context

A marketplace loses money to fraud from two sides:

- **Buyers** with stolen cards. Card testers try many cards in a row (most fail); a working
  stolen card buys a lot, fast, from a fresh identity. Each chargeback costs the order, the goods
  and a dispute fee.
- **Sellers** who collect payouts and disappear: fake orders bought with stolen cards, stores
  buying from themselves, a burst of sales right before a large first payout.

Until now nothing looked at either. Stripe Radar scores card payments, but only the card: it
cannot see that one IP used six emails today, or that a store's members buy its products.

## Decision

**Score every checkout and every payout from plain facts, with readable rules.** `risk-rules.ts`
turns facts (counts, amounts, ages) into signals worth points; the total decides:

| Score             | Checkout                                                                                 | Payout                                   |
| ----------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------- |
| below 50          | Goes through                                                                             | Paid                                     |
| 50 to 79 (review) | Order is placed and paid, then **held**: no one can pack or ship it until staff clear it | Store's payouts **paused** until cleared |
| 80 and up (block) | **Declined** before any stock is held; the shopper sees a neutral message                | Paused (never declined)                  |

Thresholds are settings (`RISK_REVIEW_SCORE`, `RISK_BLOCK_SCORE`). Rules and points:

| Checkout signal                    |  Points | When                                                |
| ---------------------------------- | ------: | --------------------------------------------------- |
| `prior_fraud`                      |      80 | Email, account or IP tied to confirmed fraud        |
| `failed_payments`                  | 25 / 45 | 3 / 5 failed payments today from the email or IP    |
| `ip_velocity`                      | 20 / 40 | 5 / 10 other checkouts from the IP in an hour       |
| `emails_per_ip`                    | 15 / 30 | 3 / 5 emails used from the IP today                 |
| `email_velocity`                   |      25 | 5 other checkouts with the email in an hour         |
| `radar_elevated` / `radar_highest` | 30 / 60 | Stripe Radar's verdict, added after payment         |
| `new_account_high_value`           |      20 | Account under a day old, order of $500 or more      |
| `high_value`                       |      20 | Order of $3,000 or more                             |
| `disposable_email`                 |      20 | Throwaway inbox domain                              |
| `guest_high_value`                 |      15 | Guest order of $1,000 or more                       |
| `above_usual`                      |      15 | Over 5× the customer's average (two orders or more) |
| `bulk_quantity`                    |      15 | 10 or more of one item                              |
| `trusted_customer`                 |     −25 | Three good orders before                            |

| Payout signal            |          Points | When                                                                 |
| ------------------------ | --------------: | -------------------------------------------------------------------- |
| `store_fraud_orders`     |              50 | A store order confirmed as fraud in 90 days                          |
| `self_purchase`          |              40 | Orders bought by the store's own members                             |
| `store_chargebacks`      | 30 each, max 60 | Chargebacks on store orders in 90 days                               |
| `refund_rate`            |         25 / 40 | 20% / 40% of store orders refunded or cancelled (5+ orders, 30 days) |
| `new_store_large_payout` |              25 | Store approved under 30 days ago, payout of $1,000+                  |
| `sales_spike`            |              20 | This week over 5× the weekly average (or $5,000+ with no history)    |

No single weak signal reaches review; it takes two or three together, or one strong one. A
customer retrying a declined card a couple of times scores nothing.

**Where the facts come from.** Every checkout is recorded in `risk_assessments` (score,
decision, signals, email, account, IP), which is also what the velocity rules count. IP rules
are skipped for loopback and private addresses, so tests and internal calls never trip them. The
storefront forwards the shopper's IP signed with the internal key (as for sessions); the mobile
app's IP comes from the load balancer.

**Chargebacks.** Stripe's `charge.dispute.created` webhook (new `disputed` payment event) marks
the payment, opens a chargeback review for the order, and pauses payouts for every store in it,
whatever the score.

**Reviews in the Ops Center** (`/risk`, permission `risk.review`, granted to support and admin):
each held item shows its signals in words. _Clear_ releases the hold (and emails the stores: ship
it now, or payouts restarted). _Confirm fraud_ cancels and refunds a held order (the reviewer also
needs the refund permission) and makes the email, account and IP count as `prior_fraud`; on a
store, it keeps payouts paused. A store cleared in the last 30 days is not paused again for the
same or a lower score.

**Rollout switch.** `RISK_CHECKS=enforce` (default), `shadow` (score and record, never decline or
hold; for tuning and for load tests) or `off`.

**Retention.** Allowed checkouts are deleted after 90 days (the rules look back at most a day for
checkouts); held, declined and reviewed ones are kept as the record of the decision.

**Measured.** `risk.checkout_declined` and `risk.review_opened` count in
`nixzora_business_events_total`; alerts fire when declines spike (card testing, or a rule
declining real shoppers) and when reviews pile up.

## Alternatives considered

- **Stripe Radar alone.** It sees only the card, and nothing on the payout side. We use its
  verdict as one signal.
- **A machine-learning model.** Needs labelled history we do not have yet. The confirmed and
  cleared reviews are that history: once there are a few hundred, a model can be trained on the
  same recorded facts and replace the points table behind the same interface.
- **A third-party fraud service** (Signifyd, Sift, Riskified). Worth it at scale, with a
  per-order fee. The decision points (before stock is held, before a payout) stay the same, so
  one can be plugged in later.

## Consequences

- Most shoppers notice nothing. A declined shopper sees a neutral message and support's address;
  the reason is never shown, so the rules can't be probed.
- Held orders wait for a person. The `FraudReviewsPiling` alert and the daily review in the
  runbook keep that wait short; stores see "On hold, do not ship" on the order and in their
  email.
- Points and thresholds will need tuning: run in `shadow` after big changes and compare the
  Declined and Cleared tabs. Runbook: `docs/runbooks/fraud-review.md`.
