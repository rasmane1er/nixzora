-- Saved for later (p10-21, ADR-0043): cart items set aside on the account.
CREATE TABLE "saved_items" (
    "user_id" UUID NOT NULL,
    "variant_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL,
    "saved_price_cents" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "saved_items_pkey" PRIMARY KEY ("user_id", "variant_id")
);
CREATE INDEX "saved_items_user_id_created_at_idx" ON "saved_items"("user_id", "created_at");
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "saved_items" ADD CONSTRAINT "saved_items_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
