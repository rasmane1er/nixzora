# ADR-0038: Bundle & save

- Status: accepted
- Date: 2026-10-14

## Context

Tier 4, first part. Product pages already offer "Frequently bought together" (from real orders)
with one "Add all to cart" button (p10-06). What was missing is the merchandised version: a
store choosing 2 to 5 of its products and selling them together for less, the way shoppers
expect a "camera kit" or a "desk setup" to work.

## Decision

- **Bundles** (`bundles`, `bundle_items`): a title, 5–30% off, 2 to 5 products. A store bundles
  only its own listings and funds the discount; NIXZORA staff bundle NIXZORA's own products and
  can retire any bundle. Products must have a single option, so "Add bundle to cart" never needs
  a size or colour choice. The same set can't be bundled twice.
- **Pricing happens in the cart**, like every other price: a complete set (one unit of each
  product) takes the bundle's percentage off those units. A unit counts towards one set only;
  when bundles overlap, the bigger percentage is filled first, from the cheapest units. Adding a
  second camera alone doesn't make a second set; removing part of a set removes the saving.
- **On the order** the saving is part of `discountCents` (so taxes, free shipping, returns and
  refunds treat it like any discount) and is also kept as `bundleDiscountCents`, with who funds
  it per store in `bundleDiscounts`. When the order is paid, each store's part comes off its
  items before commission, so its earnings follow the bundle price.
- **Clients:** a "Bundle & save" box on each product page of the bundle (this item first, the
  price together and the saving, one add button) on the website and in the app; "Bundle
  savings" in the cart, checkout and order totals; `/sell/bundles` for stores and `/bundles`
  in Ops. The demo seed adds two NIXZORA bundles.

## Consequences

- Bundles stack with coupons and Plus member prices (the percentage applies to the price the
  member pays); Subscribe & Save deliveries ignore bundles.
- Products with several options can't be bundled yet; that would need a variant picker in the
  bundle box.
