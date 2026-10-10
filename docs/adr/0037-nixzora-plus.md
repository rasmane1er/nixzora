# ADR-0037: NIXZORA Plus membership

- Status: accepted
- Date: 2026-10-13

## Context

Tier 3, fourth part. A paid membership that makes NIXZORA the first place to shop: $7.99 a
month or $79 a year after a 30-day free trial, with free 2-day delivery on what NIXZORA ships
(no minimum), free standard shipping on everything else, member-only deal prices, and lightning
deals 30 minutes early. It must bill reliably on saved cards (ADR-0031), be easy to leave, and
run in Stripe test mode until the owner approves real charges.

## Decision

- **A fee is an order.** Each charge is an order of kind `PLUS` with one line ("NIXZORA Plus ·
  monthly"). Paying it reuses everything orders already do: saved cards and 1-click, 3-D Secure
  and the pay page, Stripe webhooks, receipts in the order history, and refunds from Ops. When a
  fee is paid, the membership's period is extended (from the end of the current one, so nobody
  loses days), and the order is marked delivered. A full refund ends the membership.
- **The membership** (`plus_memberships`, one per customer) has a plan, a status (`TRIALING`,
  `ACTIVE`, `PAST_DUE`, `ENDED`), the end of the current period, whether it is leaving at the
  end, the renewal card (or the default card), and when the trial was used (once per customer).
- **Joining:** with no trial used, the trial starts at once (no card needed yet). Otherwise the
  first period is charged now, on a chosen saved card or a new one through the pay page (a new
  card is saved for renewals, which the page says).
- **The sweep** (every 15 minutes, any number of processes, each row claimed first):
  1. A reminder 3 days before a trial turns paid and before a yearly renewal.
  2. Members who cancelled end at the end of their period, without a charge.
  3. Due renewals are charged off-session. A charge that fails (or no card) leaves the
     membership `PAST_DUE` with its benefits for 3 days, retried daily, with an email and push
     that link to the pay page. Unpaid after 3 days, it ends.
- **Benefits** (`PlusBenefits`, read by the cart and checkout):
  - Members pay no shipping. `shippingWaivedCents` is recorded on the order; for marketplace
    orders NIXZORA pays each store its usual share of shipping, so stores lose nothing.
  - Orders with NIXZORA's own items ship `TWO_DAY` (the label buyer picks a rate that arrives
    within 2 days); the cart, product page and order tracking promise 2 business days.
  - Deals get an audience: `EVERYONE` (unchanged) or `PLUS`. A Plus deal leaves the listed
    price alone; members get the deal price at the cart, and cards show "Plus price". Lightning
    deals open to members 30 minutes before they start, at the deal price, counting toward the
    deal's quantity.
  - `plusSavingsCents` on each order (free shipping plus member prices) adds up to "Plus has
    saved you $…" on the member's page.
- **Clients:** web `/plus` (benefits, plans, terms that follow the plan picked, join) and
  `/account/plus` (status, next charge, card, plan, cancel/keep, pay an unpaid renewal); app
  `Plus` screen with the same; cart and checkout show "FREE with Plus" and the 2-day promise, or
  what Plus would save; Ops `/plus` lists members with counts, MRR and "end now"; stores and
  Ops can make member-only deals.

## Consequences

- Fees carry no sales tax yet (several states tax memberships); add it before charging real
  money if counsel says so.
- Auto-renewal law (for example California's): the terms are shown next to the button, emailed
  on joining, reminders go out before trial conversion and yearly renewals, and cancelling is
  one click online. Counsel should review the wording and reminder timing before launch.
- Stripe stays in test mode on staging; switching to live keys is the owner's decision.
- Free shipping for members is a real cost: watch it against MRR in Ops.
