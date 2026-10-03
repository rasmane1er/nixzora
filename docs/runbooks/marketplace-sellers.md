# Runbook: marketplace sellers

How stores are approved, how listings are reviewed, and how to switch payouts from test mode to
Stripe Connect. Design: [ADR-0012](../adr/0012-marketplace-sellers.md).

## Approving a store (Ops Center → Sellers)

1. Filter by **pending**. Open the application.
2. Check **Payout verification**: "Details submitted" must be **Yes**. If the seller says they
   finished, press **Refresh from provider**.
3. Look at the legal name, contact and description. Search the business name; reject anything
   that impersonates a brand or looks like a reseller of counterfeits.
4. **Approve store**, or **Reject application** with a reason the seller will read.

Suspending an approved store takes every listing off sale at once. Reinstating does not
republish listings: the seller resubmits them.

## Reviewing listings (Ops Center → Listing review)

Oldest first. Approve when:

- photos show the product being sold (no stock photos of a different model, no watermarks of
  another shop);
- the title, specs and price are plausible for the category;
- the product is allowed (no weapons, recalled items, or counterfeit goods).

Otherwise **Send back** with a specific note ("Add the driver size to the specs"). Price and stock
changes on live listings do not come back to this queue; text, spec and photo changes do.

## Payouts

Available balances are sent automatically once a day (minimum $10). To pay a store now, open it in
**Sellers** and press **Pay out … now**. A **failed** payout shows Stripe's reason; the money is
already back in the store's balance and the next daily run retries it once the seller has fixed
their payout details. A payout stuck in **pending** for more than an hour means the API stopped
between debiting and transferring: check the transfer in the Stripe Dashboard (search the payout
id) before doing anything else.

To slow down payouts for a new or risky store, raise its **payout hold** in Terms.

## Switching payouts to Stripe Connect

Test mode (`PAYOUTS_PROVIDER=fake`) verifies sellers instantly and moves no money. For real
sellers:

1. In the Stripe Dashboard, open **Connect** and complete the platform profile (marketplace,
   Express accounts, platform pays fees, platform is responsible for losses).
2. Add the branding (name, icon, color) so onboarding shows NIXZORA.
3. Set `PAYOUTS_PROVIDER=stripe` for the API and make sure `STRIPE_SECRET_KEY` is set (the same
   secret as checkout). Use test keys first: Stripe's test onboarding accepts sample data.
4. Deploy. Existing test-mode sellers keep their `fake_acct_…` ids; ask them to press
   **Update payout details** in Store settings, which creates a real Connect account.

Never paste Stripe keys into chat, tickets or the repository: they go in AWS Secrets Manager.
