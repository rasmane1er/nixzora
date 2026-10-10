-- Buy X, get Y (p10-27, ADR-0049): offers across a set of products, and what orders saved.
CREATE TYPE "MultiBuyStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TABLE "multi_buys" (
    "id" UUID NOT NULL,
    "buy_qty" INTEGER NOT NULL,
    "get_qty" INTEGER NOT NULL,
    "percent_off" INTEGER NOT NULL,
    "status" "MultiBuyStatus" NOT NULL DEFAULT 'ACTIVE',
    "seller_id" UUID,
    "ends_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "multi_buys_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "multi_buys_status_idx" ON "multi_buys"("status");
CREATE INDEX "multi_buys_seller_id_idx" ON "multi_buys"("seller_id");

CREATE TABLE "multi_buy_products" (
    "multi_buy_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    CONSTRAINT "multi_buy_products_pkey" PRIMARY KEY ("multi_buy_id", "product_id")
);
CREATE INDEX "multi_buy_products_product_id_idx" ON "multi_buy_products"("product_id");
ALTER TABLE "multi_buy_products" ADD CONSTRAINT "multi_buy_products_multi_buy_id_fkey"
  FOREIGN KEY ("multi_buy_id") REFERENCES "multi_buys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "multi_buy_products" ADD CONSTRAINT "multi_buy_products_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders" ADD COLUMN "multi_buy_discount_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "multi_buy_discounts" JSONB;
ALTER TABLE "orders" ADD COLUMN "multi_buy_uses" JSONB;
