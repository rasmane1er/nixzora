# ADR-0031: Saved cards, 1-click and cancelling a just-placed order

- Status: accepted
- Date: 2026-10-11

## Context

Tier 2 payments group, first part. Until now NIXZORA kept no cards at all ("no saved cards, on
purpose"). 1-click buying, and later Subscribe & Save (which charges while the customer is away),
need a card the customer chose to keep. The owner chose opt-in saving with 1-click.

## Decision

- **Cards stay with Stripe.** A signed-in customer can tick "Save this card for next time" at
  checkout. The PaymentIntent then carries the account's Stripe customer (created on first use,
  `users.payment_customer_id`) and `setup_future_usage: off_session`, so Stripe attaches the card
  and allows later charges without the customer present. After the payment succeeds NIXZORA copies
  only brand, last four digits and expiry into `payment_cards` for display. No card number, CVC or
  token that could charge the card on its own ever reaches NIXZORA.
- **Defaults and removal.** The first saved card is the default for 1-click; customers can change
  it or remove cards (removal detaches the card at Stripe). Up to 10 cards; the oldest goes first.
  Expired cards are shown but can't be used.
- **Paying with a saved card.** Checkout takes `paymentCardId`: the intent is created and
  confirmed at once with that card. Success marks the order paid immediately (the webhook that
  follows changes nothing). A decline, or a bank asking for 3-D Secure, leaves the order waiting
  and sends the customer to the normal payment form to finish or use another card.
- **1-click.** On the product page, when the customer has a default card and an address, "Buy now
  with 1-click" places a Buy now order (ADR-0030) for the chosen option and quantity, to the
  default address, on the default card, and opens the order page.
- **Cancel within 30 minutes.** Customers can cancel a paid order themselves for 30 minutes after
  placing it, as long as nothing is packed or shipped (no store has started on its part either).
  It is refunded in full and restocked through the same path as staff cancellations.
- **Test mode.** The fake gateway mimics all of this (Visa ending 4242; card ids containing
  "decline" or "3ds" decline or ask for confirmation). Staging uses Stripe test mode and test cards
  only, and nothing here goes live until the owner reviews it there.

## Consequences

- The privacy policy now says saved cards are kept by Stripe and which details NIXZORA keeps.
- Subscribe & Save can charge the saved default card off-session; a decline there must reach the
  customer (handled with that feature).
- Card-on-file charges move fraud responsibility for 3-D Secure-exempt payments to the merchant;
  Radar and the existing fraud signals (ADR-0024) still run on every order.
