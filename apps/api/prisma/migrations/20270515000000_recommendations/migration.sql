-- Recommendations (p6-07, p6-08): product-view events.
CREATE TYPE "ProductEventType" AS ENUM ('VIEW');

CREATE TABLE "product_events" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "user_id" UUID,
    "visitor_id" TEXT,
    "type" "ProductEventType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "product_events_user_id_created_at_idx" ON "product_events"("user_id", "created_at");
CREATE INDEX "product_events_visitor_id_created_at_idx" ON "product_events"("visitor_id", "created_at");
CREATE INDEX "product_events_product_id_created_at_idx" ON "product_events"("product_id", "created_at");

ALTER TABLE "product_events" ADD CONSTRAINT "product_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_events" ADD CONSTRAINT "product_events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
