-- Store analytics (p10-25, ADR-0047): views by source and add-to-carts, per product and day.
CREATE TABLE "product_view_sources" (
    "product_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "source" TEXT NOT NULL,
    "views" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_view_sources_pkey" PRIMARY KEY ("product_id", "day", "source")
);
ALTER TABLE "product_view_sources" ADD CONSTRAINT "product_view_sources_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "product_cart_adds" (
    "product_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "adds" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "product_cart_adds_pkey" PRIMARY KEY ("product_id", "day")
);
ALTER TABLE "product_cart_adds" ADD CONSTRAINT "product_cart_adds_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
