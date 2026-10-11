# ADR-0053: The shopping redesign

- Status: accepted
- Date: 2026-10-29

## Context

The app and the website worked, but the shopping screens were flat: light headers, bordered
cards, buttons that scrolled away. The owner approved a redesign (the "NIXZORA app redesign"
canvas) that keeps the brand's ink, signal orange and paper, and brings in what shoppers know
from the big stores: search always at the top, lifted cards, savings spelled out, and the buy
button always in reach.

## Decision

- **An ink header band.** Home, Categories and Search open on a dark band (`#0E1726`,
  `#162133` in dark mode) with the logo, the cart, a white search field (with photo and barcode
  search) and "Deliver to …" from the default shipping address. Cart and Account use the same
  band with a title. The website's header is the same band, with "Deliver to" leading the
  department links, and search gets a row of its own up to tablet width.
- **Tabs: Home · Categories · Ask · Cart · Account.** Search moved into the header, so the tab
  bar gains Categories and a raised orange Ask button for the assistant. Search and Scan keep
  their routes.
- **Lifted cards.** Product cards, cart lines and summaries are white cards with an 18 px
  radius and a soft shadow (a hairline instead in dark mode, where shadows don't show). Photos
  sit on a warm tile (`#F1EEE8`, `#1A2433` dark), contained rather than cropped.
- **Cards that read like a store's.** The photo fills a rounded tile inset in the card, with the
  badge and save heart on it; a bold two-line title, rating, price with the green saving, a
  delivery truck before the date, and an Add to cart button with a cart icon. Rows (search on
  phones) also show up to three spec chips ("30h battery", "Noise cancelling") from the product's
  attributes (`cardChips`, worded per language in the `cardChips` messages); a sale needs no badge
  there since the green pill says it, and the heart sits on the photo's lower corner, clear of
  longer badges.
- **Savings in words.** A green "Save 25%" pill on cards and product pages on sale (not on
  deals, which have their own badge), and "You're saving $X" in the cart: list-price markdowns,
  member prices and every discount together.
- **The buy button stays in reach.** The app's product page has a bottom bar with quantity,
  Add to cart and Buy now; the cart has a bar with the total and Check out. On the website the
  same bars pin to the bottom on phones (760 px and below) and stay inline on wider screens.
- **Phones get rows.** Search results on phones are rows (photo left, details right), in the
  app and on the website; tablets and desktops keep the grid. The website's filters fold behind
  a "Filters" button on phones and tablets so results come first.
- **Colors.** Main buttons use `#C24D1B` (white text passes AA); the brighter `#E8622C` is for
  badges, progress and accents on ink. Savings green `#2B6A47` on `#E4F1E9`, deal red
  `#B3261E`, Plus `#3D2DB8`. Fonts are unchanged (Space Grotesk, IBM Plex Sans).

## Consequences

- One look across the app and the website; the strings are in the `shopUi` namespace (en, fr,
  es).
- Nothing changes in the API or data. Behavior is unchanged except that Search is reached from
  the header instead of a tab.
- Pages not redesigned here (checkout, orders, Seller Central, the Ops Center) keep their
  current look and pick up the shared card and button changes only.
