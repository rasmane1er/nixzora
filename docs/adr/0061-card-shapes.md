# ADR-0061: Card shapes

- Status: accepted
- Date: 2026-10-13

## Context

Every section of the home, deals and product pages used the same product card, so long pages
read as one repeated grid. Large stores vary the shape of each section so a shopper can tell at a
glance what a section is for, and so the page stays interesting while scrolling.

## Decision

- **One family, many shapes.** Same colors, type, corners and shadow as the standard card:
  - quad: four products under one title ("Deals in Home & kitchen", "New in Sports & outdoors",
    "Keep shopping for");
  - spotlight: one big deal on the dark band, the live one ending soonest;
  - deal tile: percent badge, price, countdown and claimed bar;
  - Ask card: the assistant's teal, with a question from the shopper's search or an example;
  - price drop: a saved item now cheaper, with the saving in money;
  - buy again: things that run out, with when they were last bought and a reorder button;
  - row card: photo left, facts right, for short lists ("Arrives soonest", similar products);
  - price tile: photo and price only, for sponsored and recently viewed rows;
  - coupon card: dashed edge with the clip button;
  - department circles.
  The standard card stays for grids and search, where shoppers compare.
- **Shared decisions** (`packages/validation/src/card-shapes.ts`): which smart row gets which
  shape (`rowShapes`, one Ask card at most), the spotlight deal (`spotlightDeal`, never a
  Plus-only one), and quad groups by top-level department (`departmentLookup`,
  `quadsByCategory`, full groups of four only). The web and the app call the same helpers.
- **Real data only.** Smart rows now carry `details` per product: `views` (still thinking),
  `wasCents` (saved deals) and `lastBoughtAt` (restock), so cards say true things. A shape with
  no data doesn't render; nothing is padded with filler.
- **Phones:** the card wall swipes sideways instead of stacking, so the page doesn't run long.

## Consequences

- Pages vary section by section on web and app, in English, French and Spanish.
- New sections pick a shape by job, not by habit; new shapes join `ShapeCards` on both apps.
