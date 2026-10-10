# ADR-0028: Sponsored products and smart picks

- Status: accepted
- Date: 2026-10-10

## Context

Two requests: let sellers advertise, as large marketplaces do, and make the store better at
guessing what a shopper needs. Both had to cost nothing to run, keep the privacy promise (no
advertising cookies, no cross-site tracking) and never confuse an ad with a recommendation.

## Decision

**Sponsored products, first party only.** Sellers promote their own live listings in
campaigns with a daily budget and a maximum price per click. No outside ad network.

- An ad must match the page: the search (ranked by the same search as the results), the
  category and its subcategories, products similar to the one viewed, or, on the home page,
  the shopper's own activity. Order is bid × quality (relevance nudged by rating). The price
  is a generalized second price: just enough to keep the place, between 10¢ and the bid.
- Every ad is labelled "Sponsored" in text, with "About these ads" next to it. On the web, the
  link goes through `/r/ad` (not prefetched, kept out of search engines); the app records the
  click and opens the product.
- Prices travel in a signed, 30-minute token (HMAC with a key derived from
  `ORDER_LINK_SECRET`), so a click cannot set its own price.
- Not charged: the same shopper again within 24 hours, the store's own team, shoppers with no
  id, clicks past the daily budget, expired tokens.
- Billing: clicks are charged hourly and before every payout, to the store's ad credit first
  (granted by staff, never paid out) and then as one `AD_SPEND` entry in its earnings ledger.
  An ad only runs while credit plus earnings, minus unbilled clicks, covers a click, so a store
  cannot run up a debt. Stores under fraud review show no ads.
- Staff can stop a campaign with a reason the seller sees; only staff can allow it again.

**Smart picks.** `GET /recommendations` adds up to four rows, each from one signal:
products the shopper came back to (still thinking), searches and needs told to the assistant
(stored as short interests, merged while typing, 180-day retention like views), complements of
the cart and of recent purchases (`COMPLEMENTS` in the taxonomy), restocking for things that
run out (`REPLENISH_DAYS`), and saved items that got cheaper (price kept when saved).
Customers can turn personalized picks off, which also deletes the history, or clear it.

## Consequences

- Ads and picks run on the existing search index and local embeddings: no model or ad-server
  cost. Impressions are counted per campaign, product and UTC day.
- Seller terms for ads and the state-privacy questions are in the legal review runbook.
- Later: keyword targeting and negative keywords, bid suggestions, an invoice view, and ads in
  the assistant's answers (deliberately left out for now: answers stay neutral).
