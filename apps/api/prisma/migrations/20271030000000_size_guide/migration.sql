-- Size & fit guide (p10-26, ADR-0048): size charts and how a reviewed item fit.
CREATE TYPE "ReviewFit" AS ENUM ('SMALL', 'TRUE', 'LARGE');
ALTER TABLE "reviews" ADD COLUMN "fit" "ReviewFit";

CREATE TABLE "size_charts" (
    "id" UUID NOT NULL,
    "seller_id" UUID,
    "category_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "columns" TEXT[],
    "rows" JSONB NOT NULL,
    "note" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "size_charts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "size_charts_seller_id_idx" ON "size_charts"("seller_id");
CREATE INDEX "size_charts_category_id_is_default_idx" ON "size_charts"("category_id", "is_default");
ALTER TABLE "size_charts" ADD CONSTRAINT "size_charts_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "size_charts" ADD CONSTRAINT "size_charts_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products" ADD COLUMN "size_chart_id" UUID;
ALTER TABLE "products" ADD CONSTRAINT "products_size_chart_id_fkey"
  FOREIGN KEY ("size_chart_id") REFERENCES "size_charts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
