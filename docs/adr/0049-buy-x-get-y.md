# ADR-0049: Buy X, get Y

- Status: accepted
- Date: 2026-10-25

## Context

Bundles (ADR-0038) sell a fixed set for less. Stores also asked for the other common
promotion, "Buy 2, get 1 free": any mix of a range of products, with the reward on the extra
items. NIXZORA wanted the same for its own range.

## Decision

- **Offers** (`multi_buys`, `multi_buy_products`): buy 1–9, get 1–5 (never more than bought),
  free or 10–99% off, on 1–50 products, running until ended or for 7–90 days. A store makes
  offers on its own live listings and funds them; NIXZORA staff make them on NIXZORA's own and
  can end any offer. A product can be in **one live offer** at a time, so the cart never has to
  choose between two.
- **Mix and match, cheapest free:** the cart takes the offer's units most expensive first in
  groups of buy + get, and the cheapest `get` units of each full group get the reward. One
  shared function (`multiBuySavings`) does it.
- **With other savings:** bundles first, then offers on the units bundles didn't use (a unit is
  never discounted twice), then clipped coupons, then a code. Offers stack with deals and Plus
  member prices (the reward is on the price the shopper pays).
- **On the order** the saving is part of `discountCents` and is also kept as
  `multiBuyDiscountCents`, who funds it per store (`multiBuyDiscounts`) and what each offer saved
  (`multiBuyUses`, which counts the orders that used an offer). When the order is paid, a store's
  part comes off its items before commission, like bundles.
- **Shoppers see** the terms on product cards and pages ("Buy 2, get 1 free" · Shop the offer),
  an offer page with its products, the live offers on Today's deals, and in the cart what each
  offer saved plus a nudge when more items would get the reward ("Add 1 more item from this
  offer and it's free"). "Multi-buy savings" shows in cart, checkout and order totals. Same on
  the website and in the app, on every screen size.
- **Editors:** Seller Central → Multi-buy offers, and Multi-buy offers in the Ops Center
  (`promotions.manage`). The seed adds one NIXZORA offer on Linden tops.

## Consequences

- One shared helper (`codeDiscountCents`) now works out the coupon-code part of a discount for
  every client, instead of each subtracting the other savings itself.
- Subscribe & Save deliveries ignore offers, like bundles.
- An offer's reward is per order; there's no limit per shopper yet.
