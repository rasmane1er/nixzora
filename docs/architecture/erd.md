# NIXZORA data model (ERD)

Source of truth: [`apps/api/prisma/schema.prisma`](../../apps/api/prisma/schema.prisma). This diagram covers the core tables of Phases 1–5. Phase 4 added reviews, wishlist items, coupons, customer notes and return requests (see the schema); sellers arrive in Phase 7.

```mermaid
erDiagram
  users ||--o{ sessions : "signs in on"
  users ||--o{ verification_tokens : "receives"
  users ||--o{ mfa_recovery_codes : "keeps"
  users ||--o{ user_roles : has
  roles ||--o{ user_roles : "granted to"
  roles ||--o{ role_permissions : bundles
  permissions ||--o{ role_permissions : "part of"
  users ||--o{ addresses : saves
  users |o--o{ orders : places
  users ||--o{ push_devices : "notified on"
  products ||--o| product_search_docs : "searched through"

  categories |o--o{ categories : "parent of"
  categories ||--o{ products : contains
  brands |o--o{ products : makes
  products ||--o{ product_images : shows
  products ||--|{ product_variants : "sold as"
  product_variants ||--o| inventory_items : "stocked in"
  inventory_items ||--o{ inventory_reservations : holds

  orders ||--|{ order_items : contains
  product_variants |o--o{ order_items : "bought as"
  orders ||--o{ payments : "paid by"
  payments ||--o{ refunds : "refunded by"

  users {
    uuid id PK
    text email UK
    text password_hash
    enum status
    bool mfa_enabled
    text mfa_secret_enc
  }
  sessions {
    uuid id PK
    uuid user_id FK
    text refresh_token_hash UK
    text previous_refresh_token_hash UK
    timestamp mfa_verified_at
    timestamp expires_at
    timestamp revoked_at
  }
  verification_tokens {
    uuid id PK
    uuid user_id FK
    enum purpose
    text token_hash UK
    timestamp expires_at
    timestamp used_at
  }
  mfa_recovery_codes {
    uuid id PK
    uuid user_id FK
    text code_hash
    timestamp used_at
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
    bool is_default_shipping
  }
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
    enum status
    uuid category_id FK
    uuid brand_id FK
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
    int compare_at_cents
    char currency
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
  orders {
    uuid id PK
    text number UK
    uuid user_id FK
    enum status
    int total_cents
    jsonb shipping_address
  }
  order_items {
    uuid id PK
    uuid order_id FK
    uuid variant_id FK
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
  push_devices {
    uuid id PK
    uuid user_id FK
    text token UK
    enum platform
  }
  product_search_docs {
    uuid product_id PK
    text content_hash
    text embedding_model
    vector embedding "512 dims, HNSW"
    tsvector document "generated, GIN"
  }
  refunds {
    uuid id PK
    uuid payment_id FK
    text provider_refund_id UK
    int amount_cents
  }
```

## Platform tables (no foreign keys by design)

| Table                      | Purpose                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `audit_logs`               | Append-only record of security and business events. UPDATE, DELETE and TRUNCATE are blocked by a trigger.            |
| `outbox_events`            | Transactional outbox. Rows are written with the change they describe and published by a worker.                      |
| `processed_webhook_events` | Payment webhook idempotency: each provider event id is handled once.                                                 |
| `ai_requests`              | Every model call: feature, driver, tokens, estimated cost, latency, grounding. Feeds the AI panel and the daily cap. |

## Rules

- Money is stored in integer cents with a currency code.
- `available = inventory_items.on_hand - inventory_items.reserved`; reservations expire if checkout is abandoned.
- Orders keep snapshots (titles, SKUs, prices, addresses) so history never changes when the catalog does.
- No card data is ever stored; `payments.provider_payment_id` points to the Stripe PaymentIntent.
