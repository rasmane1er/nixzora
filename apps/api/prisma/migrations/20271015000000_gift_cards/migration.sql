-- Gift cards and gift balance (p10-10).
ALTER TYPE "PaymentProvider" ADD VALUE 'GIFT_BALANCE';
CREATE TYPE "OrderKind" AS ENUM ('GOODS', 'GIFT_CARD');
CREATE TYPE "GiftCardStatus" AS ENUM ('PENDING', 'ACTIVE', 'REDEEMED', 'VOID');
CREATE TYPE "GiftEntryKind" AS ENUM ('REDEEM', 'SPEND', 'RELEASE', 'REFUND', 'GRANT');

ALTER TABLE "orders" ADD COLUMN "kind" "OrderKind" NOT NULL DEFAULT 'GOODS',
ADD COLUMN "gift_balance_cents" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "gift_cards" (
    "id" UUID NOT NULL,
    "code_hash" TEXT,
    "last4" CHAR(4),
    "amount_cents" INTEGER NOT NULL,
    "status" "GiftCardStatus" NOT NULL DEFAULT 'PENDING',
    "order_id" UUID NOT NULL,
    "recipient_email" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "sender_name" TEXT NOT NULL,
    "message" TEXT,
    "sent_at" TIMESTAMP(3),
    "redeemed_by_id" UUID,
    "redeemed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gift_cards_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "gift_cards_code_hash_key" ON "gift_cards"("code_hash");
CREATE INDEX "gift_cards_order_id_idx" ON "gift_cards"("order_id");
CREATE INDEX "gift_cards_recipient_email_idx" ON "gift_cards"("recipient_email");
ALTER TABLE "gift_cards" ADD CONSTRAINT "gift_cards_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "gift_balance_entries" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "GiftEntryKind" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "gift_card_id" UUID,
    "order_id" UUID,
    "note" TEXT,
    "created_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "gift_balance_entries_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "gift_balance_entries_user_id_created_at_idx" ON "gift_balance_entries"("user_id", "created_at");
CREATE INDEX "gift_balance_entries_order_id_idx" ON "gift_balance_entries"("order_id");
ALTER TABLE "gift_balance_entries" ADD CONSTRAINT "gift_balance_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "gift_balance_entries" ADD CONSTRAINT "gift_balance_entries_gift_card_id_fkey" FOREIGN KEY ("gift_card_id") REFERENCES "gift_cards"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "gift_balance_entries" ADD CONSTRAINT "gift_balance_entries_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
