# ADR-0055: Store vacation mode

- Status: accepted
- Date: 2026-10-31

## Context

Marketplace stores are often one or two people. When they go away, orders placed in the
meantime sit unshipped, miss their delivery dates and turn into cancellations and poor
ratings. Stores asked for a way to pause new orders without taking their listings down.

## Decision

- **A store sets the dates** (`sellers.vacation_from`, `vacation_until`, `vacation_message`):
  the first day away (today or up to 90 days ahead), optionally the day it's back (at most 90
  days later), and a short note for shoppers. Days are US Eastern, like every delivery date.
  With no return day it stays away until the store turns it off. Any owner or staff member can
  set it in Seller Central → Settings; the app's store dashboard shows it and can end it.
- **Away is worked out, not switched.** A store is away from its first day until the day it's
  back (`storeAway`), so it starts and ends on time with no job to run.
- **Listings stay visible, but can't be bought.** Search, store pages and product pages still
  show them (shoppers can save them or add them to a list), with "Store away · back Oct 18" in
  place of the delivery date and no Add to cart. Adding to a cart is refused with the reason;
  items already in a cart stay there, marked unavailable with when the store is back, and
  checkout won't include them until then. Sponsored placements skip away stores, so no one pays
  for clicks on what can't be bought. Subscribe & Save deliveries due while away are skipped,
  with the usual email.
- **Orders already placed still need shipping.** Vacation pauses new orders only; the seller
  page says so.
- **Staff see it** on the store's page in the Ops Center.

## Consequences

- No new order states and no stock changes: an away store's stock is untouched, and listings
  come back exactly as they were.
- NIXZORA's own products are never away.
