-- Phase 3: checkout, payments and fulfillment.

-- AlterEnum
ALTER TYPE "PaymentProvider" ADD VALUE 'FAKE';

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "fulfilling_at" TIMESTAMP(3),
ADD COLUMN     "shipped_at" TIMESTAMP(3),
ADD COLUMN     "tracking_carrier" TEXT,
ADD COLUMN     "tracking_number" TEXT;

-- Reference data: staff who pack and ship orders.
INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'orders.fulfill', 'Mark orders as packing, shipped or delivered')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM (VALUES
  ('support', 'orders.fulfill'),
  ('admin', 'orders.fulfill')
) AS grants("role_key", "permission_key")
JOIN "roles" r ON r."key" = grants."role_key"
JOIN "permissions" p ON p."key" = grants."permission_key"
ON CONFLICT DO NOTHING;
