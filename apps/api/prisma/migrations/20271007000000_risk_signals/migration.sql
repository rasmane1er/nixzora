-- Fraud signals on checkout and payouts (ADR-0024).

-- CreateEnum
CREATE TYPE "RiskSubject" AS ENUM ('CHECKOUT', 'PAYOUT', 'CHARGEBACK');

-- CreateEnum
CREATE TYPE "RiskDecision" AS ENUM ('ALLOW', 'REVIEW', 'BLOCK');

-- CreateEnum
CREATE TYPE "RiskReviewStatus" AS ENUM ('OPEN', 'CLEARED', 'CONFIRMED');

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "risk_hold" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "payments" ADD COLUMN     "disputed_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "sellers" ADD COLUMN     "payouts_held" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "risk_assessments" (
    "id" UUID NOT NULL,
    "subject" "RiskSubject" NOT NULL,
    "order_id" UUID,
    "seller_id" UUID,
    "user_id" UUID,
    "email" TEXT,
    "ip_address" TEXT,
    "amount_cents" INTEGER,
    "score" INTEGER NOT NULL,
    "decision" "RiskDecision" NOT NULL,
    "signals" JSONB NOT NULL,
    "enforced" BOOLEAN NOT NULL DEFAULT true,
    "status" "RiskReviewStatus",
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "risk_assessments_status_created_at_idx" ON "risk_assessments"("status", "created_at");

-- CreateIndex
CREATE INDEX "risk_assessments_order_id_idx" ON "risk_assessments"("order_id");

-- CreateIndex
CREATE INDEX "risk_assessments_seller_id_created_at_idx" ON "risk_assessments"("seller_id", "created_at");

-- CreateIndex
CREATE INDEX "risk_assessments_ip_address_created_at_idx" ON "risk_assessments"("ip_address", "created_at");

-- CreateIndex
CREATE INDEX "risk_assessments_email_created_at_idx" ON "risk_assessments"("email", "created_at");

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessments" ADD CONSTRAINT "risk_assessments_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Reference data: staff who review orders and payouts flagged as risky.
INSERT INTO "permissions" ("id", "key", "description") VALUES
  (gen_random_uuid(), 'risk.review', 'Review orders and payouts held by fraud checks')
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT r."id", p."id"
FROM (VALUES
  ('support', 'risk.review'),
  ('admin', 'risk.review')
) AS grants("role_key", "permission_key")
JOIN "roles" r ON r."key" = grants."role_key"
JOIN "permissions" p ON p."key" = grants."permission_key"
ON CONFLICT DO NOTHING;
