# ADR-0033: Subscribe & Save

- Status: accepted
- Date: 2026-10-11

## Context

Tier 2 payments group, last part: repeat deliveries at a discount, charged while the customer is
away. It builds on saved cards (ADR-0031). The owner chose seller opt-in with the seller funding
the discount; NIXZORA's own products always qualify.

## Decision

- **Who offers it.** NIXZORA's own products always; a store's listing only when the store turns it
  on in the seller portal. Turning it off ends customers' subscriptions to that listing.
- **The discount.** 5% off each item, or 10% off every item when 3 or more subscriptions arrive
  in the same delivery. It is taken off the line prices, so a store's earnings (and commission)
  follow the lower price: the store funds it. Deal prices (ADR-0030) still apply underneath.
- **Subscribing.** On a product page, a signed-in customer with a saved card and an address picks
  a schedule (every 2 weeks, month, 2 months or 3 months). The first delivery is ordered right
  away, with the customer present (3-D Secure possible). A confirmation email states the
  auto-renewal terms and how to cancel, as US automatic-renewal laws expect.
- **Deliveries.** Every 15 minutes a sweep claims due subscriptions (each row moved on by its
  interval first, so several processes never order twice) and places one order per customer,
  card and address, through the normal checkout: prices, tax, stock holds, fraud signals and the
  gift card balance (ADR-0032) all apply. The card is charged off-session.
- **When it fails.** A declined charge leaves the order waiting with a link to pay it, and emails
  and notifies the customer; three declines in a row pause the subscriptions (with an email).
  Sold-out or unavailable items skip that delivery with an email. Removing the card moves
  subscriptions to the default card, or pauses them when none is left.
- **Managing.** Customers change quantity and schedule, skip the next delivery, pause, resume or
  cancel online (web and app) at any time, with no fees.

## Consequences

- Automatic-renewal laws (e.g. California's) ask for clear terms before purchase, consent, an
  acknowledgment and easy online cancellation: the product page note, the confirmation email and
  the subscriptions page cover these; have counsel review the wording before launch.
- Off-session charges can be declined for authentication; those orders wait for the customer to
  pay from the email link rather than retrying the card automatically.
