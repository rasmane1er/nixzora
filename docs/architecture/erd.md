# NIXZORA data model (ERD)

Source of truth: [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma) and the SQL
migrations next to it. 46 tables in PostgreSQL 16, as of Phase 8. The diagrams are split by area;
each shows the tables of that area and the columns that matter for relations and rules (not every
column).

## Identity and access

```mermaid
erDiagram
  users ||--o{ sessions : "signs in on"
  users ||--o{ verification_tokens : receives
  users ||--o{ mfa_recovery_codes : keeps
  users ||--o{ passkeys : "signs in with"
  users ||--o{ device_sign_ins : "Face ID / fingerprint on"
  users ||--o{ user_identities : "Google / Apple"
  users ||--o{ user_roles : has
  roles ||--o{ user_roles : "granted to"
  roles ||--o{ role_permissions : bundles
  permissions ||--o{ role_permissions : "part of"
  users ||--o{ addresses : saves
  users ||--o{ push_devices : "notified on"

  users {
    uuid id PK
    text email UK
    text phone
    text password_hash "null: social or passkey only"
    enum status
    bool mfa_enabled
    text mfa_secret_enc
    bool marketing_emails
    timestamp terms_accepted_at
  }
  sessions {
    uuid id PK
    uuid user_id FK
    text refresh_token_hash UK
    text previous_refresh_token_hash UK
    timestamp mfa_verified_at
    timestamp revoked_at
  }
  verification_tokens {
    uuid id PK
    uuid user_id FK
    enum purpose
    text token_hash UK
    timestamp expires_at
  }
  mfa_recovery_codes {
    uuid id PK
    uuid user_id FK
    text code_hash
    timestamp used_at
  }
  passkeys {
    uuid id PK
    uuid user_id FK
    text credential_id UK
    bigint counter
  }
  device_sign_ins {
    uuid id PK
    uuid user_id FK
    text secret_hash UK
    timestamp revoked_at
  }
  user_identities {
    uuid id PK
    uuid user_id FK
    enum provider "UK with subject"
    text subject
  }
  roles {
    uuid id PK
    text key UK
  }
  permissions {
    uuid id PK
    text key UK
  }
  addresses {
    uuid id PK
    uuid user_id FK
    char country
  }
  push_devices {
    uuid id PK
    uuid user_id FK
    text token UK
  }
```

## Catalog and inventory

```mermaid
erDiagram
  categories |o--o{ categories : "parent of"
  categories ||--o{ products : contains
  brands |o--o{ products : makes
  sellers |o--o{ products : lists
  products ||--o{ product_images : shows
  products ||--|{ product_variants : "sold as"
  product_variants ||--o| inventory_items : "stocked in"
  product_variants ||--o{ inventory_reservations : "held by"
  products ||--o| product_search_docs : "searched through"

  categories {
    uuid id PK
    uuid parent_id FK
    text slug UK
  }
  brands {
    uuid id PK
    text slug UK
  }
  products {
    uuid id PK
    text slug UK
    enum status "DRAFT, PENDING_REVIEW, ACTIVE, ARCHIVED"
    uuid category_id FK
    uuid brand_id FK
    uuid seller_id FK "null: NIXZORA's own"
    jsonb attributes
  }
  product_images {
    uuid id PK
    uuid product_id FK
    text storage_key
  }
  product_variants {
    uuid id PK
    uuid product_id FK
    text sku UK
    text barcode UK
    int price_cents
    bool is_active
  }
  inventory_items {
    uuid variant_id PK
    int on_hand
    int reserved
  }
  inventory_reservations {
    uuid id PK
    uuid variant_id FK
    uuid order_id
    int quantity
    timestamp expires_at
  }
  product_search_docs {
    uuid product_id PK
    text content_hash
    vector embedding "512 dims, HNSW"
    tsvector document "generated, GIN"
  }
```

## Orders, payments and returns

```mermaid
erDiagram
  users |o--o{ orders : places
  orders ||--|{ order_items : contains
  product_variants |o--o{ order_items : "bought as"
  orders ||--o{ payments : "paid by"
  payments ||--o{ refunds : "refunded by"
  orders ||--o{ return_requests : "returned through"
  orders ||--o{ risk_assessments : "checked by"

  orders {
    uuid id PK
    text number UK
    uuid user_id FK "null: guest"
    text email
    enum status
    int total_cents
    int refunded_cents
    text coupon_code
    bool risk_hold
    jsonb shipping_address
  }
  order_items {
    uuid id PK
    uuid order_id FK
    uuid variant_id FK
    uuid seller_id FK "seller at purchase time"
    text sku
    int unit_price_cents
    int quantity
  }
  payments {
    uuid id PK
    uuid order_id FK
    enum provider
    text provider_payment_id UK
    enum status
    int amount_cents
  }
  refunds {
    uuid id PK
    uuid payment_id FK
    text provider_refund_id UK
    int amount_cents
  }
  return_requests {
    uuid id PK
    uuid order_id FK
    enum status
    jsonb items
    int refund_cents
  }
  risk_assessments {
    uuid id PK
    uuid order_id FK
    uuid seller_id FK
    enum subject "CHECKOUT, PAYOUT, CHARGEBACK"
    enum decision "ALLOW, REVIEW, BLOCK"
    enum status "OPEN, CLEARED, CONFIRMED"
    int score
    jsonb signals
    bool enforced
  }
  coupons {
    uuid id PK
    text code UK
    int value
    int max_redemptions
    int redemption_count
  }
```

`coupons` has no foreign key to orders: an order keeps the code it used (`orders.coupon_code`),
and the redemption count is raised in the same transaction as the order.

## Customers, reviews and AI

```mermaid
erDiagram
  users ||--o{ reviews : writes
  products ||--o{ reviews : "reviewed in"
  products ||--o| review_insights : "summarized by"
  users ||--o{ wishlist_items : saves
  products ||--o{ wishlist_items : "saved as"
  users ||--o{ customer_notes : "noted about"
  users |o--o{ support_requests : sends
  products ||--o{ product_events : "viewed in"

  reviews {
    uuid id PK
    uuid product_id FK "UK with user_id"
    uuid user_id FK
    int rating
    enum status
    bool verified_purchase
  }
  review_insights {
    uuid product_id PK
    text summary
    jsonb summaries "per language"
    int review_count
    text input_hash
  }
  wishlist_items {
    uuid user_id PK
    uuid product_id PK
  }
  customer_notes {
    uuid id PK
    uuid user_id FK
    text author_email
    text body
  }
  support_requests {
    uuid id PK
    text reference UK
    uuid user_id FK
    enum status
  }
  product_events {
    uuid id PK
    timestamp created_at PK "monthly partitions"
    uuid product_id FK
    uuid user_id FK
    text visitor_id
  }
```

## Marketplace

```mermaid
erDiagram
  users ||--o| seller_application_drafts : "applies with"
  sellers ||--|{ seller_members : "run by"
  users ||--o| seller_members : "belongs to"
  sellers ||--o| seller_owners : "owned by"
  orders ||--o{ seller_orders : "split into"
  sellers ||--o{ seller_orders : ships
  seller_orders ||--o| seller_ratings : "rated by"
  sellers ||--o{ seller_ledger_entries : earns
  seller_orders |o--o{ seller_ledger_entries : "posts"
  payouts |o--o{ seller_ledger_entries : settles
  sellers ||--o{ payouts : "paid by"

  sellers {
    uuid id PK
    text handle UK
    enum status
    text payout_account_id UK "Stripe Connect"
    bool payouts_enabled
    bool payouts_held "fraud review"
    int commission_bps
    int payout_hold_days
  }
  seller_owners {
    uuid seller_id PK
    text date_of_birth_enc "encrypted"
  }
  seller_members {
    uuid seller_id PK
    uuid user_id PK "UK: one store per user"
  }
  seller_application_drafts {
    uuid user_id PK
    int step
    jsonb data
  }
  seller_orders {
    uuid id PK
    uuid order_id FK "UK with seller_id"
    uuid seller_id FK
    enum status
    int commission_cents
    int net_cents
    int refunded_cents
  }
  seller_ratings {
    uuid id PK
    uuid seller_order_id FK, UK
    int rating
  }
  seller_ledger_entries {
    uuid id PK
    uuid seller_id FK
    uuid seller_order_id FK
    uuid payout_id FK
    int amount_cents "signed"
    timestamp available_at
    text idempotency_key UK
  }
  payouts {
    uuid id PK
    uuid seller_id FK
    int amount_cents
    enum status
    text provider_transfer_id UK
  }
```

## Platform tables (no foreign keys by design)

| Table                      | Purpose                                                                                                                                      |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `audit_logs`               | Append-only record of security and business events. UPDATE, DELETE and TRUNCATE are blocked by a trigger. Monthly partitions.                |
| `outbox_events`            | Transactional outbox. Rows are written with the change they describe and published by the worker (and to Kafka when on). Monthly partitions. |
| `processed_webhook_events` | Webhook idempotency: each provider event id is handled once.                                                                                 |
| `ai_requests`              | Every model call: feature, driver, tokens, estimated cost, latency, grounding. Feeds the AI panel and the daily cap.                         |

`audit_logs`, `outbox_events` and `product_events` are partitioned by month on `created_at`
([ADR-0022](../adr/0022-read-replica-and-partitioning.md)); their primary key is
`(id, created_at)`, the partitions live in the `partitions` schema, and old ones are dropped by
the retention job.

## Rules

- Money is stored in integer cents with a currency code. Seller money moves only through
  `seller_ledger_entries` (append-only, signed amounts, idempotency key per event); a payout
  settles the entries it covers ([ADR-0013](../adr/0013-marketplace-orders-and-earnings.md),
  [ADR-0014](../adr/0014-seller-payouts.md)).
- `available = inventory_items.on_hand - inventory_items.reserved`; reservations expire if
  checkout is abandoned. Every stock change locks the rows in id order.
- Orders keep snapshots (titles, SKUs, prices, seller, addresses) so history never changes when
  the catalog does.
- No card data is ever stored; `payments.provider_payment_id` points to the Stripe PaymentIntent.
  Seller bank details stay in Stripe Connect; a seller owner's date of birth is encrypted.
- Ids are UUID v7 (time-ordered, so new rows land at the end of each index).
- Personal data: deleting an account erases or anonymizes it; orders stay for tax and refund
  records but no longer point to a person. Allowed-checkout risk records are deleted after 90
  days.
