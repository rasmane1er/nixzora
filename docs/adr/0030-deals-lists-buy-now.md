# ADR-0030: Deals, lists and registries, and Buy now

- Status: accepted
- Date: 2026-10-11

## Context

Tier 2 of the gap list against the large marketplaces, first part: the shopping tools that need
no payment provider changes. Gift cards, Subscribe & Save and saved cards / one-click come later
in a payments pass, because they move money and need a Stripe review first.

## Decision

- **Deals (p10-07).** A deal is a percentage off every variant of one product for a set time.
  Lightning deals run up to 12 hours and usually have a quantity; day deals run up to 7 days.
  Stores create them for their own active listings in the seller portal; staff create them for
  any product in the Ops Center (`promotions.manage`). Every minute a sweep (advisory-locked per
  deal, safe from any process) starts due deals and ends finished ones. Starting a deal saves
  each variant's price, lowers it and shows the regular price as "was"; ending puts the saved
  prices back. While a deal is live the product's prices can't be edited (409), so ending never
  overwrites a change. Paid orders count units against the live deal; a limited deal ends when
  it sells out. Only one deal per product at a time. Price changes go through the usual
  `catalog.product.updated` event, so search and caches follow.
  Shown as `/deals` (live, ending soonest first, and "starting soon"), a "Today's deals" rail on
  the home page, a badge with a countdown and "% claimed" on every product card, and on the
  product page.
- **Lists and registries (p10-08).** Besides "Saved", customers keep up to 30 named lists of up
  to 200 products, each a plain list or a registry (with an event date and a note). A list is
  private until its owner turns on sharing; then anyone with its private link
  (`/lists/<token>`, 128 random bits) can view it, seeing the owner's first name and last
  initial only, never an email. A new link can be made at any time (the old one stops working).
  Registries start shared, lists start private. Shared pages are never indexed.
  "Add to list" on product pages (web and app) ticks lists on and off or starts a new one.
- **Buy now (p10-05).** "Buy now" puts just the chosen item in a separate cart in Redis
  (`cart:b:<id>`, 6-hour expiry, the id a 256-bit secret like a guest cart's) and opens checkout
  with it (`buyNowId`). The shopper's own cart is never touched or emptied, and the separate cart
  is cleared once the order is paid. Coupons stay with the main cart.

## Consequences

- One migration (`deals`, `shopping_lists`, `shopping_list_items`); no new services or keys.
- A deal changes stored prices, so the price history (and price-drop alerts) see deal prices
  like any other price change; this is intended: shoppers who saved the product hear about it.
- Times in the seller and Ops forms are entered in the browser's time zone and stored in UTC.
