# ADR-0022: Read replica for catalog reads; monthly partitions for the event tables

- Status: Accepted
- Date: 2026-10-06
- Roadmap: p8-06 (read replicas and order-table partitioning)
- Builds on: ADR-0004 (append-only audit log), ADR-0006 (outbox), ADR-0010 (recommendations)

## Context

Most database load is reading: every storefront page lists products, the product page loads
variants, ratings and related products, and recommendations run vector and co-occurrence
queries. All of it hits the single primary that also takes every checkout write.

Three tables only ever grow: `audit_logs` (every security-relevant action, append-only),
`product_events` (every product view, for recommendations) and `outbox_events` (every business
event). They are cleaned with `DELETE … WHERE created_at < …`, which bloats tables and indexes
and makes vacuum work hard as volume grows.

The roadmap item said "order-table partitioning". We looked at it and chose not to partition
`orders` (see below).

## Decision

**A read replica for stale-tolerant reads.** With `DATABASE_REPLICA_URL` (or
`DATABASE_REPLICA_HOST`, using the primary's credentials), `ReadDatabase` gives services a
second Prisma client:

- Used by the public catalog (`CatalogQueryService`: lists, product pages, ratings) and the
  recommendation queries (similar, bought together, also viewed, popular). Everything a customer
  just changed (cart, checkout, orders, account, wishlist, recently viewed) reads the primary,
  so nobody sees their own write disappear.
- The replica's lag is measured every 15 s (`pg_last_xact_replay_timestamp`). More than 30 s
  behind, or a connection error, and reads go to the primary on their own; the replica is tried
  again after 30 s. A replica outage never takes the storefront down.
- `GET /api/v1/health` shows `replica: { status, lagSeconds }`; a CloudWatch alarm fires when
  RDS `ReplicaLag` exceeds 60 s.
- Terraform: `db_read_replica = { enabled = true }` adds an RDS replica of the primary (same
  instance class by default, about 15 USD a month on staging). Off by default.

**Monthly range partitions for the three event tables.** Each becomes a table partitioned by
`created_at`, with partitions such as `partitions.audit_logs_2026_10` and a `DEFAULT` partition
as a safety net. The migration moves existing rows in one transaction.

- The primary key becomes `(id, created_at)` (PostgreSQL requires the partition key in it). Ids
  stay unique (UUIDv7 or a sequence); the application still finds rows by id.
- Prisma cannot describe partitioning, so the parents are external tables in
  `prisma.config.ts`: their hand-written migration owns the structure and drift checks skip
  them. The partitions live in the `partitions` schema, which Prisma does not inspect.
- `PartitionMaintenance` runs in the worker at start-up and daily. It creates partitions three
  months ahead, then drops whole months past retention with `DETACH` + `DROP` (instant, no
  bloat):
  - `product_events`: 6 months, the recommendations' window.
  - `outbox_events`: 3 months, never dropping a month that still holds an event waiting for a
    handler, or for Kafka when streaming is on.
  - `audit_logs`: kept forever unless `AUDIT_RETENTION_MONTHS` (at least 12) is set. The
    append-only triggers are recreated on the partitioned table: rows still cannot be updated,
    deleted or truncated.

**Why not partition `orders`.** Eight tables reference `orders` with foreign keys (items,
payments, refunds, returns, seller orders…). With partitioning, every one of them would have to
reference `(id, created_at)`, which means a composite key in each table, in the API and in every
query, plus cross-partition uniqueness that PostgreSQL cannot enforce on `id` alone. Volume does
not call for it: at 10,000 orders a day, `orders` grows by about 3.6 million rows a year, which
one indexed PostgreSQL table serves well for many years. If that changes, the path is to move
old, closed orders to an archive table, not to partition the live one.

## Consequences

- Catalog traffic scales by adding replicas (or a larger replica) without touching checkout.
- Reads on the replica can be up to 30 s stale in the worst case; prices and stock are always
  checked again on the primary at checkout.
- Old events disappear a month at a time, with no `DELETE` bloat; queries that filter by
  `created_at` only touch the months they need.
- Structural changes to the three event tables are written as SQL migrations by hand (as for
  `product_search_docs`).
