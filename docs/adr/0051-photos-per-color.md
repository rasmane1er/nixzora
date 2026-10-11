# ADR-0051: Photos per color

- Status: accepted
- Date: 2026-10-27

## Context

A tee in three colors showed the same photos whichever color the shopper chose, and cards gave
no hint that other colors existed. Shoppers want to see the color they're about to buy.

## Decision

- **A photo can belong to a color** (`product_images.color`, null for every color). Stores tag
  photos in Seller Central and staff in the Ops Center, from the product's own colors only (the
  API refuses any other). Tagging is not new content, so a live listing stays live.
- **The gallery follows the chosen color:** that color's photos first, then the photos of no
  color in particular; other colors' photos are left out. A color without photos of its own
  shows every photo. One shared function (`photosForColor`) does it on the website and in the
  app. The page starts on the color of its first variant in stock, or the color in the link.
- **Cards show swatches** when a product comes in two or more colors (up to 5, then "+2"),
  in the order the store added the colors. A swatch comes from the color's name (`colorSwatch`:
  the last word it knows, so "Heather grey" is grey; two-tone names like "Navy / Orange" get
  both halves), else that color's photo, else its initial. Tapping a swatch opens the product
  with that color chosen (`?color=`). Sponsored cards skip swatches, so their click is still the
  one that counts.
- Variants with the same price are now ordered by creation (their ids), so option order no
  longer changes between page loads.

## Consequences

- No new upload path: color photos are ordinary photos with a tag.
- Only the "color" option drives photos; a product whose variants differ by another option
  (a phone's storage) keeps one set of photos.
