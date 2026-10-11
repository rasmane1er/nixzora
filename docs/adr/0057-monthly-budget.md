# ADR-0057: Monthly budget

- Status: accepted
- Date: 2026-11-07

## Context

Shoppers who want to keep their spending in check have to track it themselves, outside the
store. NIXZORA already knows what each customer paid this month, so it can show the number
where the decision happens: in the cart and at checkout.

## Decision

- **A private cap per customer** (`users.monthly_budget_cents`, $10 to $100,000, or none), set
  in Your account → Monthly budget on the web and in the app. Only the customer sees it; staff
  tools don't show it.
- **What counts is what was paid this calendar month** (US Eastern, like every date in the
  store): orders placed since the 1st, less refunds. Unpaid, cancelled and fully refunded
  orders don't count. `GET /me/budget` returns the cap, the spend and what's left (negative
  once over); it's worked out on each request, so there is nothing to reset.
- **The cart and checkout show it**: "After this order: $85 left of your $400 monthly budget",
  or, in amber, "Heads up: this order puts you $36.88 over". The cart uses the estimated total
  before tax; checkout uses its total.
- **It never blocks.** It's information for the shopper, not a limit we enforce.

## Consequences

- No new jobs or notifications. The page shows a progress bar with the month's spend.
- Guests have no budget.
