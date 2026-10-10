# Legal and tax review before launch (p9-09)

What a lawyer and a tax adviser should look at before NIXZORA takes real money. The
public pages are written in plain language and kept accurate to what the code does; this list is
what they cannot decide on their own. Nothing here is legal advice.

## Pages to review

| Page                      | Where                                                                                 | Notes                                                            |
| ------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Terms of service          | `/terms` (`apps/storefront/app/terms`, text in `packages/i18n/src/messages/legal.ts`) | English prevails; fr/es are convenience translations             |
| Privacy policy            | `/privacy`                                                                            | Matches the code as of Oct 2026; see "Kept accurate" below       |
| Return policy             | `/policies/returns`                                                                   | 30 days, all sellers                                             |
| Shipping policy           | `/policies/shipping`                                                                  | US only; $99 free-shipping threshold                             |
| Seller agreement and fees | `/policies/sellers`                                                                   | 12% commission; accepted at application (`agreementsAcceptedAt`) |
| App store privacy answers | `apps/mobile/store/privacy.md`                                                        | Must stay consistent with `/privacy`                             |

## Decisions for the lawyer

1. **Governing law and disputes.** The terms name neither. Choose the state (likely Maryland)
   and whether disputes go to courts, small claims or arbitration.
2. **Marketplace role.** The terms now say independent stores sell and ship some items and
   NIXZORA takes the payment. Confirm how NIXZORA should describe itself (marketplace or
   merchant of record for those sales) and what the seller agreement must say to match.
3. **State privacy laws.** The policy says we do not sell or share personal information and use
   no advertising cookies. Confirm whether California (CCPA/CPRA) or other state notices are
   still required at launch volumes, and whether a "Do not sell or share" link is needed.
4. **Children.** The policy says the store is not directed to children under 13 (COPPA).
5. **Warranties and liability.** The liability clause limits damages to the order amount
   "to the extent the law allows"; confirm wording for consumers.
6. **New departments (Oct 2026).** Clothing, home and kitchen, beauty and sports were added.
   Confirm whether opened beauty and personal-care items can be returned under the 30-day policy
   (many stores exclude them for hygiene), and whether sunscreen and skincare listings need extra
   seller checks (labels, ingredients, FDA rules for SPF claims).
7. **Accessibility.** A first automated pass (Oct 2026, home, search, product and sign-in pages)
   found no missing labels, image text, button names or heading problems; white text on orange
   buttons and the rating stars were below WCAG AA contrast and were fixed. A full audit by a
   specialist, with screen readers, is still to do; the lawyer may also want an accessibility
   statement page.
8. **Sponsored products and personalized picks (Oct 2026).** Sellers can pay per click to show
   their listings, labelled "Sponsored", in search, category, product and home pages; ads are
   chosen from the page and the shopper's own NIXZORA activity (views, searches, cart, saved
   items, orders, assistant requests), never from other sites, and sellers get no shopper data.
   Customers can turn personalized picks off (which also deletes that history) or clear their
   history. Confirm the FTC labelling is enough, whether this first-party ad targeting counts as
   "sharing" or "targeted advertising" under CCPA/CPRA and other state laws, and add ad terms to
   the seller agreement (pricing per click, budgets, ad credit never paid out, removal of ads
   that break the rules).
9. **Reviews with photos, questions and answers, alerts (Oct 2026).** Shoppers can add photos
   to reviews and post questions and answers, shown with their first name and initial; staff
   can hide posts. Saved products send price-drop and back-in-stock pushes and emails (on by
   default, off in preferences). Confirm the content rules and takedown process for shopper
   photos (faces, copyrighted images), whether these alerts count as marketing under CAN-SPAM
   (they are triggered by the shopper's own saves, but an opt-out link is included anyway), and
   that delivery estimates ("Arrives Thu – Tue") are worded as estimates under FTC shipping rules.

## Sales tax (tax adviser)

- Today the store charges tax only in Maryland: `TAX_RATES_BPS = "MD:600"` (6%) in the staging
  and production Terraform. Every other state is charged 0%.
- Register for a Maryland sales and use tax account before the first real sale.
- **Marketplace facilitator laws:** most states make the marketplace collect and remit tax on
  third-party sellers' sales once it passes their economic-nexus threshold (often $100,000 of
  sales or 200 transactions a year). Track sales by state from the orders data and decide when
  to register elsewhere, or switch to a tax service (e.g. Stripe Tax) before that point.
- **Clothing:** some states (for example Pennsylvania, New Jersey, Minnesota) exempt most clothing,
  or tax it differently. The flat per-state rate does not know product types yet; decide before
  selling clothing into those states, or use a tax service.
- Adding a state is a config change: `TAX_RATES_BPS = "MD:600,VA:530"` (basis points), then a
  Terraform apply. A rate service would replace this list.

## Kept accurate (re-check when the code changes)

- Card data never reaches our servers (Stripe Payment Element / PaymentSheet).
- Marketplace stores see the buyer's name, delivery address and items only: no email, phone
  or card (`SellerOrderView` in `packages/validation/src/marketplace.ts`).
- App crash reports go to Sentry with no IP address and no personal fields
  (`apps/mobile/src/lib/sentry.ts`; "Prevent storing IP addresses" is on in Sentry).
- Marketing emails only with opt-in (`marketingEmails`, default off); none are sent today.
- Product views are deleted after 180 days; order records kept for tax law.
