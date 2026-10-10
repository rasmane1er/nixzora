# ADR-0046: Follow stores

- Status: accepted
- Date: 2026-10-21

## Context

Marketplace stores want repeat customers, and shoppers who like a store want to hear when it
has something new. Until now a store page had no way to come back to it, and the app opened
store pages in the browser.

## Decision

- **Following** is a row per shopper and store (`store_follows`), up to 200 stores. A store's
  own team can't follow it. Store pages show the follower count to everyone.
- **The Following page** (web `/following`, app screen) lists live deals and listings added in
  the last 30 days from the stores you follow, then the stores themselves (with how many listings
  are new this week).
- **Deal alerts:** when a store's deal goes live, the deals job writes a `deal.started` event in
  the same transaction; followers who left alerts on (the default, switchable per store) get a
  push that opens the product. At most one per store per follower per day: the follower's
  `last_notified_at` is claimed before sending, so two deals starting together send one push.
  NIXZORA's own deals don't notify (they have no store to follow).
- **Clients:** a Follow button with the count and a Deal alerts switch on store pages; a native
  store screen in the app (product links now open it instead of the browser); Following in the
  account on both. `/s/*` and `/following` links open the app.

## Consequences

- Push only, no email, so following a store never fills an inbox; email digests can come later.
- Followed stores are in the data export and go with the account; a store that closes drops off
  everyone's list.
