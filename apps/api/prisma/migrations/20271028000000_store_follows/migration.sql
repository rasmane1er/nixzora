-- Follow stores (p10-24, ADR-0046).
CREATE TABLE "store_follows" (
    "user_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "notify" BOOLEAN NOT NULL DEFAULT true,
    "last_notified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "store_follows_pkey" PRIMARY KEY ("user_id", "seller_id")
);
CREATE INDEX "store_follows_seller_id_idx" ON "store_follows"("seller_id");
ALTER TABLE "store_follows" ADD CONSTRAINT "store_follows_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "store_follows" ADD CONSTRAINT "store_follows_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
