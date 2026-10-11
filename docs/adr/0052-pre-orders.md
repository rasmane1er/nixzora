# ADR-0052: Pre-orders

- Status: accepted
- Date: 2026-10-28

## Context

Stores want to sell a product before it's in their hands: a new release, a restock with a
known date. Shoppers want to secure one now and know when it ships.

## Decision

- **A release date makes a pre-order.** A product with `release_date` after today (US Eastern)
  is a pre-order; on that day it becomes an ordinary product again, with no job to run. Stores
  set it on the listing in Seller Central, staff in the Ops Center: after today and at most
  180 days ahead (`releaseDateProblem`). Saving the form again with the date it already has is
  fine, and a release date is a sales term, not content, so a live listing stays live.
- **The stock is the pre-order allowance.** The units a store lists are how many it can
  pre-sell. Holds, checkout, payment and restocking on cancel work exactly as for any product,
  so nothing new can oversell.
- **Charged at checkout, cancellable until release day.** Card authorizations expire after
  about a week, and charging later would mean off-session payments that can fail weeks after the
  shopper left. So the shopper pays now, and can cancel the order themselves until release day
  begins (instead of the usual 30 minutes), with a full refund and the units back on sale.
- **Dates follow the release.** Cards, product pages, the cart and orders count delivery from
  the release day (`deliveryFrom`, `twoDayFrom` for Plus members on NIXZORA's own items), and
  each pre-ordered order line keeps the day it ships from (`order_items.ships_on`), which the
  order's tracking estimate and the store's order page use. One order ships once, so a cart
  mixing a pre-order with in-stock items says the whole order ships at release and suggests
  ordering the others separately.
- **Shoppers see** a "Pre-order" badge on cards, a box on the product page ("Ships from Mon,
  Nov 9 · you pay today and can cancel until release day"), a "Pre-order" button, the date on
  cart and checkout lines, and the note on the order. Subscribe & Save isn't offered on a
  pre-order. Website and app, every screen size.
- The demo seed makes the Pulse S watch a pre-order 30 days out (once; it becomes ordinary when
  the day passes).

## Consequences

- No per-variant release dates: the whole product releases on one day.
- Stores can ship early if stock arrives early; the date is a promise, not a lock.
- No automatic message on release day yet; the order page and tracking show the date.
