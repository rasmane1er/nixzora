# ADR-0039: "Bought in past month" and delivery dates on product cards

- Status: accepted
- Date: 2026-10-14

## Context

Shoppers decide from the results grid. Two things big marketplaces show on every card help most:
how popular a product is ("50+ bought in past month") and when it would arrive ("FREE delivery
Tomorrow, Oct 11"). Product pages already had the delivery promise (p10-04); cards did not.

## Decision

- **Bought in past month:** every product card (and product page) carries units sold in paid
  orders over the last 30 days, rounded down to 10, 20, 50, 100, 200, 500, 1K… and hidden below
  10, so slow sellers aren't exposed and exact sales stay private. Unpaid and fully cancelled
  or refunded orders don't count. It is computed with the card's other live facts (ratings,
  deals) in one grouped query; `order_items.variant_id` is now indexed for it.
- **Delivery date:** each card carries the same delivery window as the product page (the
  store's handling time, or NIXZORA's), whether shipping is free at that price, and whether
  NIXZORA ships it. Clients show the latest day as "FREE delivery by Tue, Oct 20" (or
  "Delivery by …" under the free-shipping line), "Tomorrow, Oct 11" when that is the day. A
  Plus member sees "FREE 2-day delivery" with the 2-day date on items NIXZORA ships (ADR-0037).
- The numbers are real, never seeded: a new store shows none until 10 units sell in a month.

## Consequences

- Cards cached by the storefront (5 minutes at most) can show yesterday's date for a few minutes
  after the 2 pm ET cutoff.
