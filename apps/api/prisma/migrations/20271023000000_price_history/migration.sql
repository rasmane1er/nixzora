-- Price history (p10-19, ADR-0041): a point each time a product's lowest live price changes.
CREATE TABLE "price_points" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "price_points_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "price_points_product_id_recorded_at_idx" ON "price_points"("product_id", "recorded_at");
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
