# ADR-0029: Search help, delivery dates, reviews with photos, Q&A and alerts

- Status: accepted
- Date: 2026-10-10

## Context

Tier 1 of the gap list against the large marketplaces: things shoppers notice at once, all
buildable without paid services.

## Decision

- **Search help.** `GET /catalog/suggest` offers popular searches (only once three different
  shoppers ran them, so nobody's search is shown to others), words from the catalog, departments,
  brands and the top products. "Did you mean" fixes words against the catalog's own vocabulary
  (titles, brands, departments in every language, spec words) by edit distance; a search that
  finds nothing is retried with the fix and says so (`correctedQuery`). No dictionary service.
- **Spec filters.** `GET /catalog/facets` lists variant options first (color, size…), then known
  specs, with counts that ignore the facet's own choice. Listings take repeatable
  `f=key:value` filters: values of one key are alternatives, keys must all match.
- **Delivery dates.** One rule in `@nixzora/validation` (`deliveryWindow`): 2 pm Eastern cutoff,
  the store's handling days, 2–5 business days of ground transit, weekends and fixed carrier
  holidays skipped. Shown on product pages, cart, checkout and orders; a carrier's own estimate
  replaces it once there is one.
- **Tracking.** EasyPost tracker webhooks now keep every scan (`shipment_events`, stored once
  each) and the carrier estimate (`shipment_trackers`); the order page shows them.
- **Reviews.** Up to four photos per review, checked and re-encoded like product photos; one
  "helpful" vote per customer (not on your own); sort by most helpful; "with photos" filter.
- **Questions and answers.** Anyone signed in asks (10 a day); the store selling it, NIXZORA
  staff and customers who received it answer, each labelled. Posts go live at once; staff
  hide what breaks the rules. Stores see unanswered questions in the seller portal.
- **Alerts.** Saved products get a price-drop alert (5% or more) and, while sold out, a
  back-in-stock alert; shoppers can also ask on a sold-out page. A half-hourly sweep sends a push
  and an email once per event. Off in preferences.
- **Bought together.** One "Add all to cart" for the item and what sells with it.

## Consequences

- Two migrations' worth of tables; no new services or keys.
- Fake shipping (staging) has no carrier scans: the order page shows the estimate and steps.
