-- Clip coupons (p10-18, ADR-0040): product coupons shoppers clip, applied at checkout once.
CREATE TYPE "ClipCouponKind" AS ENUM ('PERCENT', 'AMOUNT');
CREATE TYPE "ClipCouponStatus" AS ENUM ('ACTIVE', 'ENDED');

CREATE TABLE "clip_coupons" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "kind" "ClipCouponKind" NOT NULL,
    "percent_off" INTEGER,
    "amount_off_cents" INTEGER,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "max_redemptions" INTEGER,
    "redeemed" INTEGER NOT NULL DEFAULT 0,
    "status" "ClipCouponStatus" NOT NULL DEFAULT 'ACTIVE',
    "seller_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "clip_coupons_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "clip_coupons_value_check" CHECK (
      ("kind" = 'PERCENT' AND "percent_off" BETWEEN 1 AND 90 AND "amount_off_cents" IS NULL) OR
      ("kind" = 'AMOUNT' AND "amount_off_cents" > 0 AND "percent_off" IS NULL)),
    CONSTRAINT "clip_coupons_redeemed_check" CHECK ("max_redemptions" IS NULL OR "redeemed" <= "max_redemptions")
);
CREATE INDEX "clip_coupons_product_id_status_idx" ON "clip_coupons"("product_id", "status");
CREATE INDEX "clip_coupons_status_ends_at_idx" ON "clip_coupons"("status", "ends_at");
ALTER TABLE "clip_coupons" ADD CONSTRAINT "clip_coupons_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "coupon_clips" (
    "id" UUID NOT NULL,
    "coupon_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "order_id" UUID,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "coupon_clips_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "coupon_clips_coupon_id_user_id_key" ON "coupon_clips"("coupon_id", "user_id");
CREATE INDEX "coupon_clips_user_id_idx" ON "coupon_clips"("user_id");
CREATE INDEX "coupon_clips_order_id_idx" ON "coupon_clips"("order_id");
ALTER TABLE "coupon_clips" ADD CONSTRAINT "coupon_clips_coupon_id_fkey"
  FOREIGN KEY ("coupon_id") REFERENCES "clip_coupons"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_clips" ADD CONSTRAINT "coupon_clips_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "coupon_clips" ADD CONSTRAINT "coupon_clips_order_id_fkey"
  FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD COLUMN "clip_discount_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "clip_discounts" JSONB;
