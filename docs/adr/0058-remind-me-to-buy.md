# ADR-0058: Remind me to buy

- Status: accepted
- Date: 2026-11-08

## Context

Shoppers often find something they want but aren't ready to buy: they're waiting for payday,
the weekend, or to think it over. Saving it to a list relies on them remembering to come back.

## Decision

- **"Remind me to buy" on product pages** (web and app, for products that can be bought now).
  Quick choices are tomorrow, the coming Friday and the next payday (the 1st or 15th), soonest
  first, plus any day up to 90 days ahead. Signed-out shoppers are asked to sign in.
- **One reminder per customer and product** (`buy_reminders`): setting it again moves it. It
  keeps the price when it was set.
- **At 9:00 Eastern on the day**, a sweep (every 15 minutes) sends a push and an email with
  today's price; if the price dropped since it was set, it says so ("now $65, was $80"). The
  reminder is deleted as it's sent, so it goes out once. Reminders for products no longer on
  sale, or for closed accounts, are dropped without a message.
- **Your account → Buy reminders** lists them with the product's current price, and each can
  be cancelled there or on the product page.

## Consequences

- Reminders aren't affected by the price and stock alert setting: the customer asked for this
  one specifically.
- Times are Eastern, like every date in the store; a customer elsewhere gets it at 9:00
  Eastern.
