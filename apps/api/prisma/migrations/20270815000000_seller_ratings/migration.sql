-- p7-07: customer ratings of seller shipments, with running totals on the seller.
ALTER TABLE "sellers" ADD COLUMN "rating_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "rating_total" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "seller_ratings" (
    "id" UUID NOT NULL,
    "seller_order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_ratings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "seller_ratings_rating_check" CHECK ("rating" BETWEEN 1 AND 5)
);

CREATE UNIQUE INDEX "seller_ratings_seller_order_id_key" ON "seller_ratings"("seller_order_id");
CREATE INDEX "seller_ratings_seller_id_created_at_idx" ON "seller_ratings"("seller_id", "created_at");

ALTER TABLE "seller_ratings" ADD CONSTRAINT "seller_ratings_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_ratings" ADD CONSTRAINT "seller_ratings_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
