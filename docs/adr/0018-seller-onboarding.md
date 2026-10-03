# ADR-0018: Seller onboarding in six steps

- Status: Accepted
- Date: 2026-10-03
- Roadmap: p8-13 (seller onboarding wizard)
- Builds on: ADR-0012 (marketplace sellers), ADR-0013 (orders and earnings), ADR-0014 (payouts)

## Context

The seller application was one form: store name, legal name, email, description and a terms
checkbox. Staff could not tell who ran a store or what it sold, stores had no branding or
shipping settings, and the 12% commission was a single sentence that left shipping, tax,
coupons and refunds ambiguous. A long form also had to be finished in one sitting.

## Decision

**Six steps with a saved draft.** Business → Owner → Store → Shipping & returns → Payments &
fees → Review. Every step posts to the server, which keeps what was typed in
`seller_application_drafts` (even when it is invalid, so nothing is lost) and checks the step
with its own schema (`SELLER_STEP_SCHEMAS`). "Save & continue later" and "Back" save without
checking. Submitting builds the full `SellerApplicationSchema`, creates the store (`PENDING`)
and deletes the draft in one transaction.

**Public and private are labelled and stored apart.**

| Public on the store                                                                       | Private                                                              |
| ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| store name, logo, banner, description, category, website, support contact, shipping speed | legal name, business type and address, what they sell, contact email |
| —                                                                                         | owner: legal name, date of birth, phone, country (`seller_owners`)   |

The owner's date of birth is encrypted with `DATA_ENCRYPTION_KEY` (falling back to
`MFA_ENCRYPTION_KEY`), kept out of the audit log, and shown only to staff with `sellers.manage`
in Ops Center. Identity documents, bank accounts and tax forms stay with Stripe Connect.

**Stripe after submitting.** A connected account needs a store, so the Payments step explains
fees and Stripe, and the post-submission checklist (Business ✓, Store ✓, Identity, Payment
verification, Final review) carries the "Connect Stripe" action.

**Fees spelled out from the engine's rules.** Commission on the item price only; shipping passes
through; tax never reaches the seller; coupons are NIXZORA's; refunds return the commission on
the refunded amount; cancellations before shipping cost nothing; no card-processing, listing or
monthly fee. A calculator uses `sellerProceeds`, the same arithmetic as the commission engine.

**Shipping and returns are settings, not prose.** Handling time (1–2 business days), carriers and
regions (the contiguous US is required; NIXZORA delivers to US addresses only) are stored on the
store and editable in Store settings; the Marketplace Return Policy is a separate agreement.

## Consequences

- Stores that applied before this keep working; their new fields are empty until the owner
  fills them in Store settings, and Ops Center shows "Application" only when there is one.
- The header shows "Sell" to everyone and "Seller dashboard" to store members (one extra
  `/seller/me` call per page for signed-in customers).
- The mobile app links to the same flow on the website; seller tools stay on the web.
