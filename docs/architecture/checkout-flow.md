# Checkout and payment flow

```mermaid
sequenceDiagram
  autonumber
  participant B as Browser
  participant W as Storefront (Next.js server)
  participant A as API
  participant DB as PostgreSQL
  participant R as Redis
  participant S as Stripe

  B->>W: Add to cart (server action)
  W->>A: POST /cart/items (X-Cart-Id or Bearer)
  A->>R: HSET cart:g:<id> variant qty
  B->>W: Submit address
  W->>A: POST /checkout
  A->>R: read cart
  A->>A: fraud signals (score: allow · hold for review · decline 403)
  A->>DB: re-price, apply coupon, hold stock (FOR UPDATE), create order, risk record, outbox (one tx)
  A->>S: create PaymentIntent (idempotency key = order id)
  A-->>W: order number, signed link token, client secret
  W-->>B: /checkout/pay/NX-…?token=…
  B->>S: confirm payment (Payment Element iframe; card data never reaches NIXZORA)
  S-->>B: redirect to /orders/NX-…?token=…&confirming=1
  S->>A: webhook payment_intent.succeeded (signed)
  A->>DB: record event id, order PAID, split by seller, commit stock, outbox order.paid (one tx)
  A->>R: empty cart
  A-->>A: outbox worker → receipt email (SES)
  B->>W: order page refreshes until PAID
```

Along the way:

- **Fraud signals** ([ADR-0024](../adr/0024-fraud-signals.md)) score the checkout before any stock
  is held. A high score declines it (`ORDER_DECLINED`); a middle score lets it through but holds
  the order (`risk_hold`) until staff clear it in the Ops Center, so it cannot be started or
  shipped. Stripe's own risk level and later disputes feed the same record.
- **Coupons** are checked and counted in the order's transaction: two checkouts racing for the last
  use of a single-use code get one success and one "used up".
- **Marketplace items** ([ADR-0013](../adr/0013-marketplace-orders-and-earnings.md)): at payment
  the order is split into one `seller_orders` row per store, with the commission fixed then. Each
  store ships its part; earnings enter the seller's ledger and become payable after the hold
  period ([ADR-0014](../adr/0014-seller-payouts.md)).
- **Paying late**: if the stock holds expired while the shopper was on the payment page, paying
  again renews them in one locked transaction; if stock ran out meanwhile, the shopper is told
  before paying.

## Endpoints

| Method | Path                                    | Who                       | Purpose                                 |
| ------ | --------------------------------------- | ------------------------- | --------------------------------------- |
| GET    | `/api/v1/cart`                          | guest (X-Cart-Id) or user | Priced cart, `?region=MD` estimates tax |
| POST   | `/api/v1/cart/items`                    | guest or user             | Add (creates a guest cart id if needed) |
| PATCH  | `/api/v1/cart/items/:variantId`         | guest or user             | Set quantity (0 removes)                |
| POST   | `/api/v1/cart/merge`                    | user                      | Move a guest cart into the account      |
| POST   | `/api/v1/checkout`                      | guest or user             | Create order + payment session          |
| GET    | `/api/v1/orders/:number?token=`         | link holder or owner      | Order status page                       |
| POST   | `/api/v1/orders/:number/payment?token=` | link holder or owner      | Resume payment (renews stock holds)     |
| POST   | `/api/v1/payments/webhooks/stripe`      | Stripe (signed)           | Payment results                         |
| POST   | `/api/v1/payments/fake/confirm`         | development only          | Test-mode payment results               |
| GET    | `/api/v1/me/orders`, `/me/orders/:n`    | customer                  | Order history                           |
| CRUD   | `/api/v1/me/addresses`                  | customer                  | Address book                            |
| GET    | `/api/v1/admin/orders`, `/:id`          | `orders.read.all`         | Ops Center order list and detail        |
| POST   | `/api/v1/admin/orders/:id/fulfillment`  | `orders.fulfill`          | start · ship · deliver · cancel         |
| POST   | `/api/v1/cart/coupon`                   | guest or user             | Apply a discount code                   |
| GET    | `/api/v1/admin/risk`, `/:id`            | `risk.review`             | Fraud reviews (Ops Center)              |
| POST   | `/api/v1/admin/risk/:id/review`         | `risk.review`             | Clear or confirm a held order           |

Cancelling a paid order also needs `orders.refund`.

## Trying real Stripe payments locally

1. In the Stripe dashboard (test mode) copy the publishable and secret keys.
2. Install the Stripe CLI and run `stripe listen --forward-to localhost:4000/api/v1/payments/webhooks/stripe`; copy the `whsec_…` secret it prints.
3. In `apps/api/.env` set `PAYMENTS_PROVIDER=stripe` and the three keys, then restart `pnpm dev`.
4. Pay with card `4242 4242 4242 4242`, any future date and any CVC.
