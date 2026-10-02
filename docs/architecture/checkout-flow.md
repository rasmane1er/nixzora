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
  A->>DB: re-price, hold stock (FOR UPDATE), create order + outbox (one tx)
  A->>S: create PaymentIntent (idempotency key = order id)
  A-->>W: order number, signed link token, client secret
  W-->>B: /checkout/pay/NX-…?token=…
  B->>S: confirm payment (Payment Element iframe; card data never reaches NIXZORA)
  S-->>B: redirect to /orders/NX-…?token=…&confirming=1
  S->>A: webhook payment_intent.succeeded (signed)
  A->>DB: record event id, order PAID, commit stock, outbox order.paid (one tx)
  A->>R: empty cart
  A-->>A: outbox worker → receipt email (SES)
  B->>W: order page refreshes until PAID
```

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

Cancelling a paid order also needs `orders.refund`.

## Trying real Stripe payments locally

1. In the Stripe dashboard (test mode) copy the publishable and secret keys.
2. Install the Stripe CLI and run `stripe listen --forward-to localhost:4000/api/v1/payments/webhooks/stripe`; copy the `whsec_…` secret it prints.
3. In `apps/api/.env` set `PAYMENTS_PROVIDER=stripe` and the three keys, then restart `pnpm dev`.
4. Pay with card `4242 4242 4242 4242`, any future date and any CVC.
