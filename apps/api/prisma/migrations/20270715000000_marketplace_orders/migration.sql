-- Marketplace orders: split by seller, commission and the earnings ledger (p7-04, p7-05, ADR-0013).
CREATE TYPE "SellerOrderStatus" AS ENUM ('PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED');
CREATE TYPE "SellerLedgerType" AS ENUM ('SALE', 'REFUND', 'PAYOUT', 'ADJUSTMENT');

ALTER TABLE "order_items" ADD COLUMN "seller_id" UUID;
CREATE INDEX "order_items_seller_id_idx" ON "order_items"("seller_id");
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "seller_orders" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "status" "SellerOrderStatus" NOT NULL DEFAULT 'PAID',
    "items_cents" INTEGER NOT NULL,
    "shipping_cents" INTEGER NOT NULL,
    "commission_bps" INTEGER NOT NULL,
    "commission_cents" INTEGER NOT NULL,
    "net_cents" INTEGER NOT NULL,
    "refunded_cents" INTEGER NOT NULL DEFAULT 0,
    "tracking_carrier" TEXT,
    "tracking_number" TEXT,
    "shipped_at" TIMESTAMP(3),
    "delivered_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_orders_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seller_orders_order_id_seller_id_key" ON "seller_orders"("order_id", "seller_id");
CREATE INDEX "seller_orders_seller_id_status_created_at_idx" ON "seller_orders"("seller_id", "status", "created_at");
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_orders" ADD CONSTRAINT "seller_orders_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "seller_ledger_entries" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "seller_order_id" UUID,
    "type" "SellerLedgerType" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "available_at" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_ledger_entries_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "seller_ledger_entries_idempotency_key_key" ON "seller_ledger_entries"("idempotency_key");
CREATE INDEX "seller_ledger_entries_seller_id_available_at_idx" ON "seller_ledger_entries"("seller_id", "available_at");
CREATE INDEX "seller_ledger_entries_seller_order_id_idx" ON "seller_ledger_entries"("seller_order_id");
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_ledger_entries" ADD CONSTRAINT "seller_ledger_entries_seller_order_id_fkey" FOREIGN KEY ("seller_order_id") REFERENCES "seller_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
