# ADR-0006: Cart, checkout and order lifecycle

- Status: Accepted
- Date: 2027-01-04

## Context

Phase 3 delivers the first purchase (v0.1). It has to be correct under concurrency (two people
buying the last unit), safe against tampering (a client changing prices), tolerant of
payment-provider retries, and simple enough for one part-time developer to run.

## Decision

**Cart.** Redis hash per cart (`cart:g:<id>` for guests, `cart:u:<userId>` for accounts), 30-day
expiry, at most 50 lines and 20 units per line. Guests get a 256-bit random id that the
storefront keeps in an HttpOnly cookie. Carts store quantities only; every read re-prices from
PostgreSQL and flags lines that are sold out or short. At sign-in the guest cart merges into the
account cart.

**Checkout.** One request (`POST /checkout`):

1. Re-price the cart on the server and refuse if any line changed (`409 CART_CHANGED`).
2. Hold stock for 15 minutes with row locks (ADR-0005 inventory rules), all or nothing.
3. Create the order with snapshots of titles, SKUs, prices and the address, in one transaction
   with an `order.created` outbox event.
4. Create a payment intent with the order id as idempotency key, and return its client secret.

**Payment.** The order becomes `PAID` only when the provider's signed webhook says so. Each
event id is recorded in `processed_webhook_events` in the same transaction as the state change,
so retries are no-ops. Payment success commits the stock (using the hold, or free stock if the
hold expired; any shortfall raises an `order.stock_shortfall` event for staff), writes
`order.paid` to the outbox and empties the cart. A test gateway (`PAYMENTS_PROVIDER=fake`)
produces the same events without a card; production refuses to start with it.

**Lifecycle.** `PENDING_PAYMENT → PAID → FULFILLING → SHIPPED → DELIVERED`, or `CANCELLED`.
Transitions are conditional updates (`WHERE status IN …`) so two staff members can't double-ship.
Cancelling a paid order refunds in full at the provider first, then restocks. Unpaid orders are
cancelled after 24 hours.

**Guests' order access.** Order links carry `HMAC-SHA256(ORDER_LINK_SECRET, order id)`: nothing
to store, can't be guessed, and can be re-created for every email.

**Totals.** Flat shipping ($9.99, free from $99) and state sales tax only where registered
(`TAX_RATES_BPS`, Maryland at launch). Stripe Tax replaces the table before selling in more
states (Phase 4).

**Emails.** Receipt, shipped and cancelled emails are outbox handlers, sent after the
transaction commits, retried up to 10 times. Amazon SES in production.

## Consequences

- A crash between payment and email can't lose the email; a duplicate webhook can't double-ship.
- The browser never sees card data (Stripe Payment Element), keeping PCI scope minimal.
- Holds can expire while a customer is on the payment page; the page renews them on load and
  the paid-but-short case is surfaced to staff rather than silently overselling.
- Tax logic is deliberately simple and must be replaced before multi-state nexus.
