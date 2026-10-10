# ADR-0047: Store analytics

- Status: accepted
- Date: 2026-10-22

## Context

Stores already had sales, earnings, orders, views and a daily chart (p7-08). They couldn't see
where shoppers drop off, where views come from, or how many people follow them, and the views
left out shoppers who turned personalized picks off (those views aren't recorded for picks).
The app had nothing for the people who run a store.

## Decision

- **Counts, not people.** Two tables keep counters per product and US Eastern day:
  `product_view_sources` (views by source) and `product_cart_adds`. They are incremented in place
  and hold no shopper, so they count everyone, including shoppers who turned picks off, without
  storing what those shoppers looked at. A quick repeat view by a shopper with picks on isn't
  counted twice.
- **Sources** come from the previous page's path on the website (search, categories and brands,
  the store page, deals and coupons, home and recommendations, Following, the assistant), "other
  websites" for any other site (only that it was another site, never which), "direct" with no
  previous page, and "app" for the app. One shared function (`trafficSource`) decides.
- **The report** adds a funnel (product views → added to cart → orders, with the rate from each
  step to the next), views by source as bars with a table view, followers (total and new), and
  carts and conversion for the top ten products. All figures now cover whole store-time days,
  today included, so the tiles add up to the daily chart. Views take the larger of the counters
  and the picks' view records, so earlier periods keep their numbers.
- **The app** shows the same report to the store's team (Your store in the account tab), with a
  link to the web for listings, orders and payouts.

## Consequences

- Sources start counting with this release; earlier views have none.
- "Buy now" orders skip the cart, so orders can be more than carts; the funnel then leaves out
  that step's rate rather than showing over 100%.
