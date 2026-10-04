# Technical debt register

Known shortcuts and their fixes. Add an item when you take a shortcut on purpose; move it to
"Paid down" with the commit when it is fixed. `pnpm knip` (in CI) keeps unused files, exports and
dependencies from piling up.

## Open

| Item                                                                                        | Where                               | Why it matters                                           | Fix                                                                  |
| ------------------------------------------------------------------------------------------- | ----------------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------- |
| Product search, price and stock filters page in memory (up to 2,000 candidates)             | `catalog-query.service.ts` `list()` | Totals cap at 2,000 for a search or filter               | Move price and stock into the search index (ADR-0015) and page there |
| Four list endpoints build their page object by hand (risk, payouts, seller orders, reviews) | those services                      | Small duplication                                        | Use `pagedResult()` when touching them                               |
| Expo pins `@types/react` 19.2 while the web apps use 19.3                                   | `apps/mobile/package.json`          | Peer warning on install                                  | Follow the next Expo SDK                                             |
| `decode-uri-component` advisory (via expo-router → query-string 7), ignored with a reason   | `pnpm-workspace.yaml`               | Slow parse of a crafted link on the shopper's own device | Drop the ignore when expo-router moves to query-string 9             |

## Paid down

October 2026 (p9-07): uploaded images are malware-scanned and re-encoded without metadata
before they are served (ADR-0025).

October 2026 (p9-06): the Content Security Policy no longer allows inline scripts; each page
view gets a nonce that Next.js puts on its own scripts (`'strict-dynamic'` covers the Stripe,
Google and Apple scripts they load).

October 2026 (buf-01, debt from Phases 0–2):

- **Low-stock list** filtered after a 500-row cap, so low stock past the first 500 variants (by
  title) never showed, and the dashboard count was wrong. Now filtered, sorted and counted in SQL.
- **Ops Center product list** loaded up to 2,000 products to show 25. Newest-first listings with
  no search now page in the database with an exact total (storefront "Newest" too).
- **Category moves** to a parent that does not exist answered 500; deleting a category that just
  got a child did too. Now 400 and 409. Category ancestry is one helper (`category-tree.ts`, unit
  tested) instead of a query per level in two places with different depth limits.
- **Product slugs**: picking a free slug read every slug starting with the title; now only
  `slug` and `slug-N`.
- **Re-holding stock** for an order (paying after the hold expired) could create two sets of holds
  on a double submit; now one transaction with a per-order lock. Stock arithmetic is in
  `stock-math.ts` with unit tests.
- **Audit log**: one `AuditService.recordFor()` instead of five copies; staff notes and coupon
  changes are now recorded as ADMIN like every other staff action.
- **Shared definitions**: role keys, stock-adjust reasons, low-stock threshold, stock row type
  and page math now come from `@nixzora/validation`; one `isUuid()` in the Ops Center instead of
  seven regexes (one of them looser); named rate-limit profiles (`common/throttle-profiles.ts`);
  `roundRating()`.
- **Users controller** no longer queries the database itself (`OpsSummaryService`,
  `UsersAdminService`).
- **Dependencies**: `prom-client` → `@prometheus-io/client` (its new name); patch updates (AWS
  SDK, supertest, turbo); `uuid` override for a moderate advisory; unused code removed and
  `knip` added to CI.
