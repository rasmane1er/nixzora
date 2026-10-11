# ADR-0059: Get it by

- Status: accepted
- Date: 2026-11-09

## Context

Shoppers often need something by a certain day: a birthday, a trip, a project. Every card
already shows its delivery date, but there was no way to hide what won't make it, so they had
to scan every result.

## Decision

- **A "Get it by" filter** (`arriveBy=2026-10-16` on `/catalog/products`) on search and
  category pages, web and app. Chips offer the three soonest days things can arrive (the
  latest day of NIXZORA's own delivery window, then the next two); tapping one again clears it.
- **It uses the same dates as the cards** (standard shipping, the latest day of the window):
  a product qualifies when it's in stock, isn't a pre-order, its store isn't away (ADR-0055),
  and its handling time still gets it there by that day. The API works out the most handling
  days that make it (`maxHandlingDaysBy`) and filters in the database, so paging and totals
  stay exact.
- **Sponsored products follow the filter**, so nothing shown breaks the promise.

## Consequences

- NIXZORA Plus 2-day delivery isn't counted: the filter is the promise for everyone, and Plus
  members often get things sooner than it says.
- Pre-orders are left out even when their release day would fit; they're rare and say when they
  ship.
- Spec and option counts in the filter panel don't follow the date.
