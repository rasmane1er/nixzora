-- Seller shipments are verified by the carrier before their earnings can be paid out (p9-05).

-- AlterTable
ALTER TABLE "seller_orders" ADD COLUMN     "tracking_verified_at" TIMESTAMP(3);

-- Shipments from before this change count as verified, so nothing already earned is held back.
UPDATE "seller_orders" SET "tracking_verified_at" = "shipped_at" WHERE "shipped_at" IS NOT NULL;
