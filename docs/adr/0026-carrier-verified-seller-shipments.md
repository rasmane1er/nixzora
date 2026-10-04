# ADR-0026: Seller earnings wait for the carrier's first scan

- Status: Accepted
- Date: 2026-10-04
- Roadmap: p9-05 (verify seller tracking numbers before releasing earnings)
- Builds on: ADR-0013 (earnings ledger), ADR-0014 (payouts), ADR-0024 (fraud signals)

## Context

A seller ships an order by typing a carrier and a tracking number. Shipping credits the store's
ledger, and the money becomes payable after the store's hold period (14 days by default). Nothing
checked that the tracking number was real: a store could "ship" orders it never sends, wait out
the hold and be paid before buyers complain. The hold only delays that; it does not stop it.

NIXZORA already receives EasyPost tracker webhooks for the labels it buys itself.

## Decision

**When a tracking provider is configured, a seller's earnings do not start their hold until the
carrier has scanned the parcel.**

1. On ship, the API asks the shipping gateway to track the seller's number (EasyPost: create a
   tracker; webhooks follow). The ledger entry is written with `available_at` set to a far-future
   marker (`AWAITING_CARRIER_SCAN`), so every existing balance and payout query treats it as not
   yet payable, with no other change.
2. The first `in_transit` or `delivered` update for that number sets
   `seller_orders.tracking_verified_at` and moves the entry's date to _shipped date + hold days_,
   the date it would have had before. `delivered` also marks the seller's part delivered.
3. A payout signal, `tracking_not_scanned` (50 points, a review), fires when a store has
   shipments still unscanned after 7 days. Its payouts pause until staff review it in the Ops
   Center. Clearing the review accepts those shipments (their earnings become available);
   confirming it keeps them held.
4. Sellers see the amount waiting for a scan on their earnings page, and a note on each such
   order; staff see it on the store's page.

Without a tracking provider (development, the demo, or `SHIPPING_PROVIDER=none`) the seller's
word is taken, as before. If EasyPost is down when a seller ships, the shipment still waits for
a scan, so an outage cannot be used to skip the check.

## Consequences

- A store can no longer be paid for parcels that never entered a carrier's network, except by
  passing a staff review.
- Earnings reach sellers a day or two later than before for parcels scanned late; the hold
  period is still counted from the ship date, so a normal shipment loses nothing.
- EasyPost bills per tracker created. That is small next to label costs.
- Shipments made before this change count as verified (the migration sets their scan date to
  the ship date).
