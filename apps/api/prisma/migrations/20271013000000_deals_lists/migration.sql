-- Deals (p10-07) and lists and registries (p10-08).

-- CreateEnum
CREATE TYPE "DealKind" AS ENUM ('LIGHTNING', 'DAY');
CREATE TYPE "DealStatus" AS ENUM ('SCHEDULED', 'LIVE', 'ENDED', 'CANCELLED');
CREATE TYPE "ShoppingListKind" AS ENUM ('LIST', 'REGISTRY');

-- CreateTable
CREATE TABLE "deals" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "kind" "DealKind" NOT NULL,
    "percent_off" INTEGER NOT NULL,
    "starts_at" TIMESTAMP(3) NOT NULL,
    "ends_at" TIMESTAMP(3) NOT NULL,
    "quantity" INTEGER,
    "claimed" INTEGER NOT NULL DEFAULT 0,
    "status" "DealStatus" NOT NULL DEFAULT 'SCHEDULED',
    "original_prices" JSONB,
    "seller_id" UUID,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shopping_lists" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "ShoppingListKind" NOT NULL DEFAULT 'LIST',
    "event_date" DATE,
    "note" TEXT,
    "is_shared" BOOLEAN NOT NULL DEFAULT false,
    "share_token" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shopping_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "shopping_list_items" (
    "list_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopping_list_items_pkey" PRIMARY KEY ("list_id","product_id")
);

-- CreateIndex
CREATE INDEX "deals_status_starts_at_idx" ON "deals"("status", "starts_at");
CREATE INDEX "deals_status_ends_at_idx" ON "deals"("status", "ends_at");
CREATE INDEX "deals_product_id_status_idx" ON "deals"("product_id", "status");
CREATE UNIQUE INDEX "shopping_lists_share_token_key" ON "shopping_lists"("share_token");
CREATE INDEX "shopping_lists_user_id_created_at_idx" ON "shopping_lists"("user_id", "created_at");
CREATE INDEX "shopping_list_items_product_id_idx" ON "shopping_list_items"("product_id");

-- AddForeignKey
ALTER TABLE "deals" ADD CONSTRAINT "deals_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_lists" ADD CONSTRAINT "shopping_lists_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_list_id_fkey" FOREIGN KEY ("list_id") REFERENCES "shopping_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "shopping_list_items" ADD CONSTRAINT "shopping_list_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
