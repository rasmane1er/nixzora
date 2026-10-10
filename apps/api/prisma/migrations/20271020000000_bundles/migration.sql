-- Bundle & save (p10-16, ADR-0038): products sold together at a percentage off the set.
CREATE TYPE "BundleStatus" AS ENUM ('ACTIVE', 'ARCHIVED');

CREATE TABLE "bundles" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "percent_off" INTEGER NOT NULL,
    "status" "BundleStatus" NOT NULL DEFAULT 'ACTIVE',
    "seller_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bundles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "bundles_percent_off_check" CHECK ("percent_off" BETWEEN 1 AND 90)
);
CREATE INDEX "bundles_status_idx" ON "bundles"("status");
CREATE INDEX "bundles_seller_id_idx" ON "bundles"("seller_id");

CREATE TABLE "bundle_items" (
    "bundle_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "bundle_items_pkey" PRIMARY KEY ("bundle_id", "product_id")
);
CREATE INDEX "bundle_items_product_id_idx" ON "bundle_items"("product_id");
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_fkey"
  FOREIGN KEY ("bundle_id") REFERENCES "bundles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD COLUMN "bundle_discount_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "bundle_discounts" JSONB;
