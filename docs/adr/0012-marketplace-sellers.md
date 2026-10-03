# ADR-0012: Marketplace sellers, payouts verification and listing review

- Status: accepted
- Date: 2026-10-03
- Roadmap: p7-01 (seller registration and verification), p7-02 (seller portal), p7-03 (listings),
  p7-10 (admin seller management and moderation)

## Context

Phase 7 turns NIXZORA into a marketplace: independent businesses list products next to the
first-party catalog, and NIXZORA takes a commission. Three questions had to be settled first:
how sellers prove who they are and get paid, where they work, and how we stop bad listings
reaching shoppers.

## Decision

**Sellers live in the monolith** (module `sellers`, ADR-0001). A `Seller` is a business with a
public handle (`/s/<handle>`), a status (`PENDING → ACTIVE`, or `SUSPENDED` / `REJECTED`), a
commission in basis points (12% default) and a payout hold in days (14 default). `SellerMember`
links user accounts to a store (one store per user; `OWNER` or `STAFF`). `Product.sellerId` is
null for NIXZORA's own products, so every existing query keeps working.

**Payouts and identity go through Stripe Connect Express**, behind a `PayoutGateway` interface
next to the payment gateway (ADR-0003):

- Stripe hosts onboarding (identity, tax and bank details) and the seller's payout dashboard.
  NIXZORA stores only the connected account id and three facts: details submitted, payouts
  enabled, and what is still due. No bank or identity document touches our servers.
- NIXZORA charges shoppers on the platform account and transfers each seller's share later
  ("separate charges and transfers"). One checkout can then contain several sellers, and refunds
  and holds stay under our control. The connected account only needs the `transfers` capability.
- `PAYOUTS_PROVIDER=fake` verifies instantly and moves no money, for development, tests and the
  public demo. Like the fake payment gateway, production refuses it unless `ALLOW_TEST_PAYMENTS`
  is set.
- Status is pulled from Stripe when the seller returns from onboarding and when staff press
  "Refresh". A Connect webhook (`account.updated`) is added with payouts (p7-06).

**The seller portal is part of the storefront** (`/sell`), not a fourth app. Sellers already have
a customer account there; one sign-in, one session model (ADR-0002), no new service to run. The
Ops Center stays staff-only behind MFA. Seller API routes (`/api/v1/seller/*`) check membership on
every call and treat other stores' products as not found.

**Every listing is reviewed before it goes live.**

```
DRAFT ──submit──▶ PENDING_REVIEW ──approve──▶ ACTIVE
  ▲                    │ send back (note)       │ content edit, new photo
  └────────────────────┘◀───────────────────────┘ (back to PENDING_REVIEW)
```

- Sellers never set a status directly; submitting needs an approved store, an active variant and
  a photo.
- On a live listing, price, stock and variant changes apply at once. Changes to the title,
  description, specs, category or photos send it back to review (an unchanged form re-save does
  not).
- Staff send listings back with a note the seller sees; the storefront never shows it.
- Suspending or rejecting a store moves its live and pending listings to draft in the same
  transaction, so nothing from it stays on sale. Reinstating does not republish anything.

**Bulk listings.** Sellers can upload a CSV (template and export provided): new SKUs become
drafts, known SKUs get the file's price and stock, and the whole file is checked first: nothing
is saved while any row has an error, and errors are reported by row and column. Images are not
imported from URLs, so the server never fetches addresses supplied by sellers.

**Seller tools.** The AI listing assistant (p7-09) reuses the staff copy generator (ADR-0011):
a description drafted from the listing's own specs, with every number checked against them,
never saved automatically, 30 drafts per store per day. Seller analytics (p7-08) show sales,
earnings, orders, units, product views and conversion for 7, 30 or 90 days against the previous
period, days counted in US Eastern time, from read-only queries over the store's own data.

Store approval requires finished payout verification, and every decision (apply, approve,
suspend, terms change, listing approved or sent back) is in the audit log. Staff need the new
`sellers.manage` permission (admins, catalog managers) for stores and `catalog.write` for listing
review.

## Consequences

- Shoppers see "Sold by …" on every product page and can open a seller's store page.
- Search, recommendations and the assistant need no changes: they only ever read `ACTIVE`
  products, and status changes go through the outbox like any catalog change.
- Split orders, commission and transfers (p7-05, p7-06) build on `commissionBps`,
  `payoutHoldDays` and the connected account id stored here.
- A review queue costs staff time; if it grows, low-risk changes (price, stock) are already
  exempt, and auto-approval for trusted sellers can be added per seller later.
