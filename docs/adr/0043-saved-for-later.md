# ADR-0043: Saved for later

- Status: accepted
- Date: 2026-10-18

## Context

Tier 5 starts with the small things shoppers use every day. Today the only way to set a cart
item aside is to delete it (and find it again) or move it to the wish list, which loses the
option and quantity.

## Decision

- **Saved items live on the account** (`saved_items`: user, variant, quantity, the price when
  saved), at most 100. Carts stay in Redis (ADR-0006) for guests and accounts alike; saved items
  are kept for good, so they are a table. Saving needs sign-in; guests get a sign-in link.
- **Moving, not copying:** "Save for later" takes the line out of the cart with its quantity;
  "Move to cart" puts it back through the normal add-to-cart checks (a sold-out item stays saved
  and says so). Saving the same item again updates it and brings it to the top.
- **Prices are read live**, like the cart: today's price (the member price for Plus members),
  with "Price dropped $X since you saved it" or "went up" from the price kept at saving time.
- **API:** `POST /cart/items/:variantId/save`, `POST /me/saved/:variantId/cart` (both return
  the cart and the list), `GET /me/saved`, `DELETE /me/saved/:variantId`.
- **Clients:** a "Save for later" link on each cart line and a Saved for later list under the
  cart, also when the cart is empty, on the web and in the app.

## Consequences

- Saved items are in the data export and go with the account; a variant removed from the
  catalog drops out of everyone's list.
