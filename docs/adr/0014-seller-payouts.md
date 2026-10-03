# ADR-0014: Seller payouts

- Status: accepted
- Date: 2026-10-03
- Roadmap: p7-06 (payouts, with payout holds for new sellers)

## Context

Sellers accumulate earnings in an append-only ledger (ADR-0013). Money reaches them through
Stripe Connect (ADR-0012): NIXZORA's platform balance pays the seller's connected account with a
transfer, and Stripe pays the seller's bank on its own schedule. The risk is sending money twice,
or losing track of money when a transfer fails.

## Decision

A `Payout` sends a store's **whole available balance** (ledger entries past their hold):

1. In one transaction, holding a Postgres advisory lock for that seller, refuse if a payout is
   already `PENDING`, compute the available balance, refuse below `PAYOUT_MIN_CENTS` ($10), create
   the payout as `PENDING` and write a `PAYOUT` ledger entry for minus the amount.
2. Outside the transaction, ask the gateway to transfer, with the payout id as the provider's
   idempotency key.
3. On success the payout is `PAID` with the provider's transfer id. On failure it is `FAILED`, the
   reason is kept, and an `ADJUSTMENT` entry credits the amount back.

The balance is debited before money moves, so concurrent runs, retries and double clicks can't
pay the same money twice. A crash between steps 1 and 2 leaves a `PENDING` payout, which blocks
new payouts for that store and is visible to staff, rather than silently re-sending.

**When.** Every API task checks hourly; a Redis lock lets one run at a time. A store is paid when
it is approved, payout-verified with the active provider, has at least $10 available and had no
payout in the last 24 hours. Staff with `sellers.manage` (and MFA) can pay out immediately from the
Ops Center. Sellers get an email for each payout and see payouts on their Earnings page.

**Holds.** Each sale is held for the store's `payoutHoldDays` after shipping (14 by default).
Staff raise it for new or risky stores and lower it for proven ones; refunds after a payout make
the available balance negative, and later sales repay it before anything else is sent.

`PAYOUTS_PROVIDER=fake` transfers instantly with no money (development, tests, the demo);
`stripe` creates real Stripe transfers.

## Consequences

- A failed transfer (for example, an unverified bank) never loses money: it returns to the
  balance and is retried by the next daily run once the store fixes its details.
- Stripe's own payout from the connected account to the bank, and its failures, are visible in
  the seller's Express dashboard; mirroring them with Connect webhooks is a follow-up.
- Transfers need funds in NIXZORA's Stripe balance. Charges settle on Stripe's schedule (usually
  2 days), well inside the 14-day hold.
