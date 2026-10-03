-- Marketplace sellers (Phase 7, ADR-0012).
ALTER TYPE "ProductStatus" ADD VALUE IF NOT EXISTS 'PENDING_REVIEW' BEFORE 'ACTIVE';

CREATE TYPE "SellerStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
CREATE TYPE "SellerMemberRole" AS ENUM ('OWNER', 'STAFF');

CREATE TABLE "sellers" (
    "id" UUID NOT NULL,
    "handle" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "legal_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "country" CHAR(2) NOT NULL DEFAULT 'US',
    "description" TEXT,
    "status" "SellerStatus" NOT NULL DEFAULT 'PENDING',
    "status_reason" TEXT,
    "payout_provider" TEXT,
    "payout_account_id" TEXT,
    "details_submitted" BOOLEAN NOT NULL DEFAULT false,
    "payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
    "requirements_due" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "commission_bps" INTEGER NOT NULL DEFAULT 1200,
    "payout_hold_days" INTEGER NOT NULL DEFAULT 14,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sellers_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "sellers_commission_bps_check" CHECK ("commission_bps" BETWEEN 0 AND 5000),
    CONSTRAINT "sellers_payout_hold_days_check" CHECK ("payout_hold_days" BETWEEN 0 AND 90)
);
CREATE UNIQUE INDEX "sellers_handle_key" ON "sellers"("handle");
CREATE UNIQUE INDEX "sellers_payout_account_id_key" ON "sellers"("payout_account_id");
CREATE INDEX "sellers_status_created_at_idx" ON "sellers"("status", "created_at");

CREATE TABLE "seller_members" (
    "seller_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "SellerMemberRole" NOT NULL DEFAULT 'OWNER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_members_pkey" PRIMARY KEY ("seller_id", "user_id")
);
CREATE UNIQUE INDEX "seller_members_user_id_key" ON "seller_members"("user_id");
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_members" ADD CONSTRAINT "seller_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "products" ADD COLUMN "seller_id" UUID;
ALTER TABLE "products" ADD COLUMN "review_note" TEXT;
ALTER TABLE "products" ADD CONSTRAINT "products_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "products_seller_id_status_idx" ON "products"("seller_id", "status");

-- Reference data: staff permission to approve, suspend and configure sellers.
INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'sellers.manage', 'Approve, suspend and configure marketplace sellers')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM (VALUES
  ('catalog_manager', 'sellers.manage'),
  ('admin', 'sellers.manage')
) AS grants("role_key", "permission_key")
JOIN "roles" r ON r."key" = grants."role_key"
JOIN "permissions" p ON p."key" = grants."permission_key"
ON CONFLICT DO NOTHING;
