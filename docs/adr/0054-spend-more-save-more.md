# ADR-0054: Spend more, save more

- Status: accepted
- Date: 2026-10-30

## Context

Bundles (ADR-0038) and Buy X, get Y (ADR-0049) reward buying certain products together. Stores
also wanted the other classic: a bigger order earns money off, whatever's in it ("Spend $50,
save $5 · Spend $100, save $15"), to raise order size across the whole store.

## Decision

- **Offers** (`spend_offers`): 1–3 tiers of "spend at least X, save Y" (X from $10 to $2,000;
  each tier with a higher spend and a bigger saving; a saving at most half its spend), running
  until ended or for 1–90 days. Amounts off only, no percentages: "save $15" is clearer at a
  glance and can't grow without limit on a large order. A store has **one live offer** at a
  time and funds it; NIXZORA staff run NIXZORA's own and can end any store's. The tiers are
  stored as JSON on the offer, since they're always read and written together.
- **What counts:** everything the shopper buys from that store in the order, after bundles and
  Buy X, get Y (a unit's saving is never counted as spend). The highest tier reached applies,
  never more than the spend. One shared function (`spendSavings`) does it.
- **With other savings:** bundles, then offers, then spend tiers, then clipped coupons, then a
  code. Tiers stack with deals and Plus member prices (the spend is what the shopper pays).
- **On the order** the saving is part of `discountCents`, kept as `spendDiscountCents`, with who
  funds it per store (`spendDiscounts`) and what each offer saved (`spendUses`, which counts the
  orders that used it). When the order is paid, a store's part comes off its items before
  commission, like bundles and offers.
- **Shoppers see** the tiers on the store's product pages (with a link to the store), the live
  offers on Today's deals, and in the cart what each store's tiers saved or how much more
  reaches the next ("Spend $20 more with Brightline Audio to save $15"). "Spend & save savings"
  shows in cart, checkout and order totals. Same on the website and in the app.
- **Editors:** Seller Central → Spend more, save more, and the same page in the Ops Center
  (`promotions.manage`). The seed adds tiers on the demo store, Brightline Audio (not on
  NIXZORA's own range, which tests buy at list price).

## Consequences

- `codeDiscountCents` now also subtracts spend tiers, so every client still shows the code's
  part of a discount correctly.
- Subscribe & Save deliveries ignore tiers, like bundles and offers.
- Product cards don't show tiers (they're about the store, not the product); the product page,
  cart and Today's deals do.
