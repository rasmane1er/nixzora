-- Review insights (p6-04): "what customers say" per product.
CREATE TABLE "review_insights" (
    "product_id" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "pros" JSONB NOT NULL,
    "cons" JSONB NOT NULL,
    "review_count" INTEGER NOT NULL,
    "average_rating" DOUBLE PRECISION NOT NULL,
    "positive_pct" INTEGER NOT NULL,
    "model" TEXT NOT NULL,
    "input_hash" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_insights_pkey" PRIMARY KEY ("product_id")
);

ALTER TABLE "review_insights" ADD CONSTRAINT "review_insights_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
