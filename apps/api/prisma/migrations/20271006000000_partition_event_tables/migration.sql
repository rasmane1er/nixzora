-- Monthly range partitions for the three append-only event tables (ADR-0022): audit_logs,
-- product_events and outbox_events. Partitions live in the "partitions" schema, which Prisma does
-- not inspect; the parents stay in "public" and are listed as external tables in prisma.config.ts.
-- The primary key becomes (id, created_at), as PostgreSQL requires the partition key in it.

CREATE SCHEMA IF NOT EXISTS partitions;

-- Creates the monthly partitions of `parent` from `from_month` to `months_ahead` months from now.
-- Idempotent; the worker calls it daily (PartitionMaintenance).
CREATE OR REPLACE FUNCTION partitions.ensure_monthly(parent regclass, from_month date, months_ahead int)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  base text := (SELECT relname FROM pg_class WHERE oid = parent);
  month date := date_trunc('month', from_month)::date;
  last date := (date_trunc('month', now()) + make_interval(months => months_ahead))::date;
  created int := 0;
  name text;
BEGIN
  WHILE month <= last LOOP
    name := format('%s_%s', base, to_char(month, 'YYYY_MM'));
    IF to_regclass(format('partitions.%I', name)) IS NULL THEN
      EXECUTE format('CREATE TABLE partitions.%I PARTITION OF %s FOR VALUES FROM (%L) TO (%L)',
        name, parent, month, (month + interval '1 month')::date);
      created := created + 1;
    END IF;
    month := (month + interval '1 month')::date;
  END LOOP;
  RETURN created;
END $$;

-- Drops the monthly partitions of `parent` that ended before `keep_months` ago. With
-- `only_if_empty_where`, a partition is kept while any row matches that condition (outbox events
-- not yet delivered).
CREATE OR REPLACE FUNCTION partitions.drop_older_than(parent regclass, keep_months int, only_if_empty_where text DEFAULT NULL)
RETURNS int LANGUAGE plpgsql AS $$
DECLARE
  cutoff date := (date_trunc('month', now()) - make_interval(months => keep_months))::date;
  part record;
  blocked boolean;
  dropped int := 0;
BEGIN
  FOR part IN
    SELECT c.oid::regclass AS rel, c.relname,
           (regexp_match(pg_get_expr(c.relpartbound, c.oid), 'TO \(''([0-9-]+)'))[1]::date AS upper
    FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
    WHERE i.inhparent = parent AND pg_get_expr(c.relpartbound, c.oid) <> 'DEFAULT'
  LOOP
    CONTINUE WHEN part.upper IS NULL OR part.upper > cutoff;
    IF only_if_empty_where IS NOT NULL THEN
      EXECUTE format('SELECT EXISTS (SELECT 1 FROM %s WHERE %s)', part.rel, only_if_empty_where) INTO blocked;
      CONTINUE WHEN blocked;
    END IF;
    EXECUTE format('ALTER TABLE %s DETACH PARTITION %s', parent, part.rel);
    EXECUTE format('DROP TABLE %s', part.rel);
    dropped := dropped + 1;
  END LOOP;
  RETURN dropped;
END $$;

-- ───── audit_logs ─────
ALTER TABLE "audit_logs" RENAME TO "audit_logs_unpartitioned";
ALTER INDEX "audit_logs_pkey" RENAME TO "audit_logs_unpartitioned_pkey";
ALTER INDEX "audit_logs_action_created_at_idx" RENAME TO "audit_logs_unpartitioned_action_idx";
ALTER INDEX "audit_logs_actor_id_created_at_idx" RENAME TO "audit_logs_unpartitioned_actor_idx";
ALTER INDEX "audit_logs_entity_type_entity_id_idx" RENAME TO "audit_logs_unpartitioned_entity_idx";
DROP TRIGGER "audit_logs_no_truncate" ON "audit_logs_unpartitioned";
DROP TRIGGER "audit_logs_no_update_or_delete" ON "audit_logs_unpartitioned";

CREATE TABLE "audit_logs" (
    "id" BIGINT NOT NULL DEFAULT nextval('audit_logs_id_seq'::regclass),
    "actor_type" "ActorType" NOT NULL,
    "actor_id" UUID,
    "action" TEXT NOT NULL,
    "entity_type" TEXT,
    "entity_id" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}'::jsonb,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");
ALTER SEQUENCE "audit_logs_id_seq" OWNED BY "audit_logs"."id";
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");
CREATE TABLE partitions."audit_logs_default" PARTITION OF "audit_logs" DEFAULT;
SELECT partitions.ensure_monthly('audit_logs',
  COALESCE((SELECT min("created_at") FROM "audit_logs_unpartitioned"), now())::date, 3);
INSERT INTO "audit_logs" ("id", "actor_type", "actor_id", "action", "entity_type", "entity_id", "ip_address", "user_agent", "metadata", "created_at")
  SELECT "id", "actor_type", "actor_id", "action", "entity_type", "entity_id", "ip_address", "user_agent", "metadata", "created_at" FROM "audit_logs_unpartitioned";
DROP TABLE "audit_logs_unpartitioned";
-- Still append-only: rows cannot be changed or deleted, nor the table truncated (ADR-0004).
CREATE TRIGGER "audit_logs_no_update_or_delete" BEFORE DELETE OR UPDATE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION audit_logs_block_mutation();
CREATE TRIGGER "audit_logs_no_truncate" BEFORE TRUNCATE ON "audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION audit_logs_block_mutation();

-- ───── product_events ─────
ALTER TABLE "product_events" RENAME TO "product_events_unpartitioned";
ALTER TABLE "product_events_unpartitioned" DROP CONSTRAINT "product_events_product_id_fkey";
ALTER TABLE "product_events_unpartitioned" DROP CONSTRAINT "product_events_user_id_fkey";
ALTER INDEX "product_events_pkey" RENAME TO "product_events_unpartitioned_pkey";
ALTER INDEX "product_events_product_id_created_at_idx" RENAME TO "product_events_unpartitioned_product_idx";
ALTER INDEX "product_events_user_id_created_at_idx" RENAME TO "product_events_unpartitioned_user_idx";
ALTER INDEX "product_events_visitor_id_created_at_idx" RENAME TO "product_events_unpartitioned_visitor_idx";

CREATE TABLE "product_events" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "user_id" UUID,
    "visitor_id" TEXT,
    "type" "ProductEventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");
CREATE INDEX "product_events_product_id_created_at_idx" ON "product_events"("product_id", "created_at");
CREATE INDEX "product_events_user_id_created_at_idx" ON "product_events"("user_id", "created_at");
CREATE INDEX "product_events_visitor_id_created_at_idx" ON "product_events"("visitor_id", "created_at");
CREATE TABLE partitions."product_events_default" PARTITION OF "product_events" DEFAULT;
SELECT partitions.ensure_monthly('product_events',
  COALESCE((SELECT min("created_at") FROM "product_events_unpartitioned"), now())::date, 3);
INSERT INTO "product_events" ("id", "product_id", "user_id", "visitor_id", "type", "created_at")
  SELECT "id", "product_id", "user_id", "visitor_id", "type", "created_at" FROM "product_events_unpartitioned";
DROP TABLE "product_events_unpartitioned";
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ───── outbox_events ─────
ALTER TABLE "outbox_events" RENAME TO "outbox_events_unpartitioned";
ALTER INDEX "outbox_events_pkey" RENAME TO "outbox_events_unpartitioned_pkey";
ALTER INDEX "outbox_events_published_at_created_at_idx" RENAME TO "outbox_events_unpartitioned_published_idx";
ALTER INDEX "outbox_events_streamed_at_created_at_idx" RENAME TO "outbox_events_unpartitioned_streamed_idx";

CREATE TABLE "outbox_events" (
    "id" UUID NOT NULL,
    "aggregate_type" TEXT NOT NULL,
    "aggregate_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "streamed_at" TIMESTAMP(3),
    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id", "created_at")
) PARTITION BY RANGE ("created_at");
CREATE INDEX "outbox_events_published_at_created_at_idx" ON "outbox_events"("published_at", "created_at");
CREATE INDEX "outbox_events_streamed_at_created_at_idx" ON "outbox_events"("streamed_at", "created_at");
CREATE TABLE partitions."outbox_events_default" PARTITION OF "outbox_events" DEFAULT;
SELECT partitions.ensure_monthly('outbox_events',
  COALESCE((SELECT min("created_at") FROM "outbox_events_unpartitioned"), now())::date, 3);
INSERT INTO "outbox_events" ("id", "aggregate_type", "aggregate_id", "type", "payload", "created_at", "published_at", "attempts", "last_error", "streamed_at")
  SELECT "id", "aggregate_type", "aggregate_id", "type", "payload", "created_at", "published_at", "attempts", "last_error", "streamed_at" FROM "outbox_events_unpartitioned";
DROP TABLE "outbox_events_unpartitioned";
