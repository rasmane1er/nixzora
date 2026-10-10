# ADR-0040: Clip coupons

- Status: accepted
- Date: 2026-10-15

## Context

Tier 4, second part. Coupon codes (WELCOME10) exist, but shoppers on big marketplaces expect
"Save 15% with coupon" on the product itself: tick it once, and it comes off at checkout. Stores
want to run them on their own listings, with a budget.

## Decision

- **A clip coupon** (`clip_coupons`) is on one product: a percentage (5–50%) off every unit of
  it in the order, or an amount off once (less than the price). It runs up to 90 days, has an
  optional budget (most orders that can use it), and one product has at most one at a time.
  Stores make coupons for their own listings and fund them; NIXZORA staff for NIXZORA's own and
  can end any.
- **Clipping** (`coupon_clips`, one per shopper and coupon) needs sign-in. A clipped coupon
  applies in the cart to that product, once per shopper: the order that uses it marks the clip
  used and counts against the budget in the same transaction (a coupon that just ran out stops
  the checkout with "Review your cart"). An unpaid order that is cancelled gives the clip and
  the budget back.
- **Money:** the saving is part of `discountCents`, after bundles and before a code, and kept
  as `clipDiscountCents` with who funds it per store (`clipDiscounts`). A store's part comes off
  its items before commission, like bundles (ADR-0038).
- **Clients:** "Save 15% with coupon" on product cards; a clip box on product pages ("Clip
  coupon" ↔ "Coupon clipped ✓"); a Coupons page (header and footer on the web, the account tab
  in the app); "Coupon savings" in the cart, checkout and order totals; `/sell/coupons` for
  stores and `/clip-coupons` in Ops. The demo seed adds two NIXZORA coupons.

## Consequences

- Clip coupons stack with bundles, Plus member prices and a code; the total discount never
  goes below zero, and each is funded by whoever offered it.
- A coupon is one use per shopper, not per unit: "Save 15%" covers every unit of that product in
  the order that uses it.
