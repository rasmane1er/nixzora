# ADR-0003: Stripe behind a payment-provider interface

- Status: Accepted (implementation in Phase 3)
- Date: 2026-10-05

## Context

NIXZORA needs card payments, Apple Pay and Google Pay now, and marketplace payouts to sellers in Phase 7. Handling card data directly would put the whole platform in a large PCI DSS scope.

## Decision

- Use **Stripe** as the first provider: Payment Element on web, the Stripe React Native SDK on mobile, and Stripe Connect for sellers in Phase 7.
- Card details go from the browser or app **directly to Stripe**. NIXZORA servers never receive, log or store card numbers, which keeps PCI scope to the smallest self-assessment level.
- The `payments` module exposes a `PaymentProvider` interface (`createIntent`, `capture`, `refund`, `parseWebhook`). `StripeProvider` is the only implementation today; another provider can be added without touching orders or checkout.
- Webhooks are verified with Stripe's signature and made **idempotent** through `processed_webhook_events`.
- Order state changes caused by payments are written together with an `outbox_events` row in one transaction.

## Consequences

- Fast, compliant launch with wallets included.
- Stripe fees apply; the interface keeps switching costs low.
- Payment logic is testable with a fake provider in unit tests.
