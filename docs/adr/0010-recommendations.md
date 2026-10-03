# ADR-0010: Recommendations from the search index, orders and product views

- Status: accepted
- Date: 2026-10-02
- Roadmap: p6-07 (recommendations), p6-08 (behavior events)

## Context

Product pages ended at the spec table, and the home page showed only "New in". Shoppers need a
way to keep browsing: similar items, what is bought together, and picks based on what they looked
at. We already have a semantic index of every product (ADR-0009) and order history.

## Decision

Three lists on the product page and two on the home page, all built in Postgres, no model calls:

| List                  | Signal                          | Query                                                                                           |
| --------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| Similar products      | `product_search_docs.embedding` | nearest neighbours of the product's vector, +0.15 same category, +0.07 same department          |
| Often bought together | paid `orders`                   | products sharing orders with this one, by order count                                           |
| Customers also viewed | `product_events` (VIEW)         | products viewed by the same shoppers, **only when at least 2 shoppers did**                     |
| Recommended for you   | viewing history                 | nearest neighbours of the average vector of the last 10 views, minus viewed and purchased items |
| Popular right now     | views + orders, 30 days         | fallback when there is no history (orders count triple)                                         |

Lists never repeat a product, sold-out items go last, and every entry is a live catalog card
(price and stock are current).

**Events.** `POST /events/views` records one VIEW per shopper per product per 30 minutes. A
shopper is the signed-in user, or a random visitor id: the `nx_vid` HttpOnly cookie on the web,
a Keychain-stored random id in the app. It is never an IP address, device or advertising id.
Events are deleted after 180 days and when the account is deleted.

## Consequences

- No new infrastructure or paid calls; quality follows the embeddings driver (local hashed
  features now, Voyage when enabled).
- With few orders and views, "bought together" and "also viewed" stay empty and are hidden; they
  fill in with traffic.
- Next steps: add-to-cart events, a nightly materialised "bought together" table once order
  volume makes the live query slow, and an evaluation set for recommendation quality.
