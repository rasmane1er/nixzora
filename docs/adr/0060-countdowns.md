# ADR-0060: Countdowns in the last 24 hours

- Status: accepted
- Date: 2026-11-10

## Context

Deals already counted down, but a day deal with five days left showing "118:42:10" reads as
noise, and other real deadlines (coupons, offers, the cancel and return windows, today's order
cutoff for a delivery date) only showed a date, so a shopper couldn't tell that one ends in two
hours.

## Decision

- **One rule everywhere** (`countdownPhase`): a date until the last 24 hours, then a countdown
  (amber), then red with "Ending soon" in the last hour, then "Ended".
- **Deals** keep their clock ("Ends in 3:07:15") in the last day, on cards and product pages.
- **"Order within 2 h 15 min"** under the delivery date on product pages, the cart and
  checkout, counting to the next order cutoff (2 pm Eastern on a business day, `orderCutoff`)
  when it's under 24 hours away. Not for pre-orders, which ship from their release day.
- **Other deadlines** use words to the minute ("Ends in 5 h 9 min"): clip coupons, account
  coupons, multi-buy and spend-more offers, "You can cancel for 18 min more" on a just-placed
  order, and "Returns close in 20 h" on orders.
- **Honest only.** Every countdown comes from an end time the server sent; nothing resets on
  reload, and nothing without a real deadline gets a timer.
- **One clock per page** (web) or app (mobile): every countdown subscribes to a single shared
  tick, updated per second for clocks and per minute for words, and the app's pauses in the
  background.

## Consequences

- Staff and seller tables (Seller Central, Ops) keep plain dates.
- Web pages render the server's date first and switch to the countdown once loaded.
