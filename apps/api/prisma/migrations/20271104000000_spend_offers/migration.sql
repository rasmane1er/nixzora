-- Spend more, save more (p10-31, ADR-0054): store-wide spend tiers, and what orders saved.
CREATE TABLE "spend_offers" (
    "id" UUID NOT NULL,
    "tiers" JSONB NOT NULL,
    "status" "MultiBuyStatus" NOT NULL DEFAULT 'ACTIVE',
    "seller_id" UUID,
    "ends_at" TIMESTAMP(3),
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "spend_offers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "spend_offers_status_idx" ON "spend_offers"("status");
CREATE INDEX "spend_offers_seller_id_idx" ON "spend_offers"("seller_id");

ALTER TABLE "orders" ADD COLUMN "spend_discount_cents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "spend_discounts" JSONB;
ALTER TABLE "orders" ADD COLUMN "spend_uses" JSONB;
