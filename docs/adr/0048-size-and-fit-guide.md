# ADR-0048: Size & fit guide

- Status: accepted
- Date: 2026-10-24

## Context

Clothing and shoe pages had no size chart and nothing on how things fit, so shoppers guessed,
and wrong sizes are the most common reason clothes come back. Stores had nowhere to put their
own measurements.

## Decision

- **Size charts** live in `size_charts`: a name, a category, the measurement columns, one row per
  size and an optional note for shoppers. A chart with no store is NIXZORA's; one of NIXZORA's
  charts per category can be that category's **default**.
- **Which chart a product shows:** the chart attached to the listing, else the default of the
  nearest category up its tree. Only products in the Clothing & shoes department get a guide.
- **Writing a chart** is one text box: a header line ("Size, Chest (in), …"), then one line per
  size, cells separated by commas or tabs (so a table pasted from a spreadsheet works). One shared
  parser (`parseSizeChart`) checks it on the website, in the Ops Center and in the API, with the
  same problems (line, duplicate size, up to 30 sizes and 8 measurements) in each language.
- **Stores** write their own charts under Seller Central → Size charts and choose one per listing
  (or leave the category's chart). They can only attach their own or NIXZORA's charts. **Staff**
  manage NIXZORA's charts and defaults in the Ops Center (`catalog.write`). Deleting a chart sends
  its listings back to the category's chart.
- **Fit from reviews:** a review of a clothing or shoe product can say how it fit (small, true to
  size, large; optional). The page shows a verdict ("Runs small · most reviewers suggest a size
  up") once at least 5 reviewers answered and one answer has at least half, and the breakdown as
  bars in the guide. Only approved reviews count.
- **Sizes in order:** the size choice lists letter sizes smallest first (XS, S, M, …) and number
  sizes by value; other values keep the store's order.
- The seed adds NIXZORA's default charts for tops, outerwear and shoes.

## Consequences

- Same guide on the website (a dialog next to the size choice) and in the app (a sheet), on every
  screen size. Ops Center primary buttons also got their missing color token back.
- A chart is stored as columns and rows, so a later "find my size" can read it directly.
- Fit is a count, not a model: it needs a handful of answers before it says anything.
