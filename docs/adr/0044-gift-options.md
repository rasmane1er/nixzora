# ADR-0044: Gift options at checkout

- Status: accepted
- Date: 2026-10-19

## Context

Shoppers send orders straight to someone else. They need the box to arrive without prices, with
a few words from them, and wrapped when they want. Marketplace orders ship in several parcels:
NIXZORA's own items from its warehouse, and each store's items from that store.

## Decision

- **One choice per order:** "This order is a gift" (`gift` on the checkout request) with an
  optional message (up to 300 characters, printed on a card) and "From". Every parcel of a gift
  ships without prices, NIXZORA's and the stores' alike.
- **Gift wrap only for what NIXZORA ships** ($4.99 per order, `GIFT_WRAP_CENTS`), because the
  wrapping happens in NIXZORA's warehouse. The cart says when it is offered (`giftWrap`); asking
  for it on a cart of store items only is refused. The fee is added after tax, kept as
  `giftWrapCents`, and is NIXZORA's: it doesn't touch store earnings or commission.
- **Who sees what:** the order (`gift` on the order view), the receipt email (a Gift box and a
  Gift wrap line), the Ops Center order page (no prices, wrap, the card) and the store's order
  page (no prices, the card; never the wrap or the buyer's totals).
- **Gift receipt:** a printable page on the web and a shareable screen in the app with the items,
  the message and the order number, and no prices.

## Consequences

- Subscribe & Save deliveries are never gifts. Returning an item doesn't refund the wrap; a
  cancelled order refunds everything, the wrap included.
- Per-item gift options (different messages per item) would need the message on order items; the
  order-level fields stay as the default.
