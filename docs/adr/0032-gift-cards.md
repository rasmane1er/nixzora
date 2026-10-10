# ADR-0032: E-gift cards and the gift card balance

- Status: accepted
- Date: 2026-10-11

## Context

Tier 2 payments group, second part. The owner chose digital gift cards with no expiry and no
fees, which keeps them simple under US gift card rules (the federal CARD Act's 5-year minimum,
and states that ban expiry or dormancy fees outright).

## Decision

- **Buying.** Signed-in customers buy an e-gift card for $10–$500 (whole dollars) at
  `/gift-cards`, for a recipient's name and email, with an optional message. It is an order of
  kind `GIFT_CARD` (no shipping, no tax, no stock), paid by card like any order (a saved card
  works too, ADR-0031) and checked by the same fraud signals (ADR-0024). A gift card can't be
  bought with gift card balance.
- **Issuing.** When the order is paid (and not held for fraud review; issued when staff clear
  it), a 16-character code from a 31-symbol alphabet without look-alike characters (~79 bits) is
  emailed once to the recipient; the buyer gets a "sent" email; the order becomes delivered.
  Only an HMAC of the code (keyed from `ORDER_LINK_SECRET`) and its last four characters are
  stored, so a database leak can't be turned into spendable codes.
- **Redeeming.** A signed-in customer adds the code under Your account › Gift cards (5 tries a
  minute per client; failures are audited). The card's full amount moves into the account's
  balance at once; a card can be redeemed once.
- **The balance.** An append-only ledger (`gift_balance_entries`: redeem, spend, release,
  refund, grant); the balance is its sum, changed only under a per-customer advisory lock so two
  checkouts can't spend the same dollars. Checkout spends the balance first (the customer can
  switch it off); the rest goes on the card. A balance that covers the whole order pays it at
  once. Each order records the part paid from the balance (`orders.gift_balance_cents`) as its
  own `GIFT_BALANCE` payment.
- **Unpaid and refunded orders.** An order that is never paid gives the balance back
  (`RELEASE`). Refunds go to the card first, then back to the balance, never more to either than
  it paid. Gift card orders refund only in full and only while no card has been redeemed; the
  cards are voided. They can't be returned.
- **Staff.** The Ops Center lists gift cards (by order, email or last four) and lets staff with
  refund rights add goodwill credit to a customer's balance, with a reason the customer sees.

## Consequences

- Sold gift card balances are a liability to account for (unredeemed and unspent amounts).
  Escheatment (unclaimed property) rules vary by state; review before launch.
- In development the email driver prints messages, gift card codes included, to the API log.
  Staging and production must send through SES so codes never land in logs.
