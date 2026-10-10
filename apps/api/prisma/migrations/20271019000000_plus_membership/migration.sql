-- NIXZORA Plus (p10-15, ADR-0037): memberships, the fee as an order kind, member deal prices,
-- and what Plus changed on an order (2-day parcel, waived shipping, savings).
ALTER TYPE "OrderKind" ADD VALUE 'PLUS';

CREATE TYPE "ShippingSpeed" AS ENUM ('STANDARD', 'TWO_DAY');
CREATE TYPE "DealAudience" AS ENUM ('EVERYONE', 'PLUS');
CREATE TYPE "PlusPlan" AS ENUM ('MONTHLY', 'YEARLY');
CREATE TYPE "PlusStatus" AS ENUM ('TRIALING', 'ACTIVE', 'PAST_DUE', 'ENDED');

CREATE TABLE "plus_memberships" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "plan" "PlusPlan" NOT NULL,
    "status" "PlusStatus" NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "payment_card_id" UUID,
    "trial_used_at" TIMESTAMP(3),
    "failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "next_attempt_at" TIMESTAMP(3),
    "reminded_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "plus_memberships_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "plus_memberships_user_id_key" ON "plus_memberships"("user_id");
CREATE INDEX "plus_memberships_status_current_period_end_idx" ON "plus_memberships"("status", "current_period_end");
ALTER TABLE "plus_memberships" ADD CONSTRAINT "plus_memberships_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders"
  ADD COLUMN "shipping_speed" "ShippingSpeed" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "shipping_waived_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "plus_savings_cents" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "plus_membership_id" UUID;
CREATE INDEX "orders_plus_membership_id_idx" ON "orders"("plus_membership_id");
ALTER TABLE "orders" ADD CONSTRAINT "orders_plus_membership_id_fkey"
  FOREIGN KEY ("plus_membership_id") REFERENCES "plus_memberships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "deals" ADD COLUMN "audience" "DealAudience" NOT NULL DEFAULT 'EVERYONE';
