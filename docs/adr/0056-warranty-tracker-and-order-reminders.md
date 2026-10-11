# ADR-0056: Warranty tracker and order reminders

- Status: accepted
- Date: 2026-11-06

## Context

Shoppers lose track of two dates that matter after a purchase: when the return window closes,
and when a warranty runs out. Most stores print the warranty on a card that gets thrown away,
and nobody reminds you before it ends. Both dates are already known to NIXZORA, so we can keep
them for the shopper.

## Decision

- **A listing can say how long its warranty is** (`products.warranty_months`, 1 to 120, or
  none). Stores set it in Seller Central's listing editor and staff in the Ops Center, from a
  short list (3, 6, 12, 24, 36, 60 months). Product pages show "2-year warranty" next to the
  shipping and returns perks.
- **Each order line keeps the warranty it was bought with** (`order_items.warranty_months`), so
  changing the listing later never changes what a customer has. Cover runs from delivery, or
  from purchase until it's delivered, to the day before the same date N months later (US
  Eastern days). Order pages show "Warranty until Oct 7, 2027" on the line.
- **Your account → Warranties** lists everything covered: still running (ending within three
  weeks first), then ended. Each one links to the product and order, and to "Contact the
  store" (a message to the store about that order) or, for NIXZORA's own items, the help chat.
- **Two reminders, by push and email**, from an hourly sweep that claims each reminder in the
  database before sending (`orders.return_reminded_at`, `order_items.warranty_reminded_at`), so
  each goes out once:
  - two days before the 30-day return window closes, for delivered goods with no return
    started (guests get the email, with their order link);
  - three weeks before a warranty ends, with the contact link.
- **Customers can turn them off** (`users.order_reminders`, on by default) in Preferences on the
  web and in the app.

## Consequences

- No warranty claims process: NIXZORA keeps the dates and connects the customer with the store;
  the store's own warranty terms apply.
- Cancelled and refunded orders have no warranty. A warranty that ended unnoticed (for example
  one bought before reminders existed) gets no late reminder.
- Demo electronics and kitchen products have 1 to 3 years, set once by the seed so editor changes
  stay.
