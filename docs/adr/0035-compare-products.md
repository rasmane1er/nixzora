# ADR-0035: Compare products

- Status: accepted
- Date: 2026-10-11

## Context

Tier 3, second part. Shoppers choosing between similar items (two laptops, three pairs of
earbuds) want them side by side rather than flipping between pages.

## Decision

- `GET /catalog/compare?products=a,b,c,d` returns up to 4 product details in the order asked
  (missing ones are skipped), every spec key any of them has (the shared ones first), and which
  keys differ. It reuses the product page query, so prices, deals, ratings and delivery dates
  match the product pages exactly.
- **Web:** a "Compare" checkbox on product pages builds a list of up to 4 (kept in the browser,
  per device; nothing is stored on the server), a bar at the bottom of the screen opens the
  comparison, and "Compare with similar items" compares the product with its 3 closest matches.
  `/compare?products=…` is a plain link, so a comparison can be shared. "Show only differences"
  hides rows that match.
- **App:** "Compare with similar items" on product pages opens the same table, which scrolls
  sideways on phones; columns can be removed.

## Consequences

- Spec labels come from the shared catalog labels, so new spec keys need a label there to read
  well (unknown keys are spelled out from the key).
