-- Gift options (p10-22, ADR-0044): a gift message, gift wrap and no prices in the box.
ALTER TABLE "orders" ADD COLUMN "is_gift" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "orders" ADD COLUMN "gift_message" TEXT;
ALTER TABLE "orders" ADD COLUMN "gift_from" TEXT;
ALTER TABLE "orders" ADD COLUMN "gift_wrap_cents" INTEGER NOT NULL DEFAULT 0;
