# ADR-0041: Browsing history and price tracking

- Status: accepted
- Date: 2026-10-16

## Context

Tier 4, third part. Shoppers want to know whether today's price is a good one and to find again
what they looked at. Price-drop alerts already exist (ADR-0029; the wish list turns them on),
and product views are already recorded for personalized picks (ADR-0028).

## Decision

- **Price points** (`price_points`): one row each time a live product's lowest active variant
  price changes. They are written right after the catalog event that changed it (created,
  updated, published) and by a sweep 30 seconds after boot and every 6 hours, which also catches
  prices changed outside those events. A write only happens when the price differs from the last
  point, so the table grows with changes, not with time.
- **The summary** (`GET /catalog/products/:slug/price-history?days=30|90|365`, public, cached
  five minutes on the web) gives the steps in the window, today's, lowest, highest and typical
  price, and `asOf`. The typical price is time-weighted, so a one-hour flash price barely moves
  it. "Lowest price in 30 days" shows only when the price changed in the window, today's price is
  below typical, and nothing in the last 30 days was lower.
- **Browsing history** (`GET /me/history`, `DELETE /me/history/:productId`) reads the views
  already recorded for picks: the last 60 products, newest first, the price when last viewed and
  how much it has dropped since, and whether a price-drop alert is on. Clearing it is the
  existing "Clear shopping history". With personalized picks off nothing new is recorded, and
  the page says so with a link to Preferences.
- **Clients:** a price-history card on product pages (range 30 days / 90 days / 1 year, the four
  numbers, a step chart with a crosshair on hover, touch and arrow keys, and the changes as a
  table), a "Lowest price in 30 days" badge under the price, and a Browsing history page in the
  account (web and app) with "Alert me if the price drops", Remove and Clear history. The web
  chart is SVG drawn at its real width; the app draws it with plain views, so no native chart
  library is added and over-the-air updates keep working.

## Consequences

- History starts when this ships: products show "The price hasn't changed" until their price
  first changes, and older views show no "price then".
- The chart is one series in one color (`#C2410C`, dark `#E8622C`), with no legend; the table
  and the text summary carry the same numbers for screen readers.
