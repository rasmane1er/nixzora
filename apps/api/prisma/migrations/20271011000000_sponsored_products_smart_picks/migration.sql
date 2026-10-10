-- Sponsored products (p10-01) and smart picks (p10-02).

-- AlterEnum
ALTER TYPE "SellerLedgerType" ADD VALUE 'AD_SPEND';

-- CreateEnum
CREATE TYPE "ShopperInterestSource" AS ENUM ('SEARCH', 'ASSISTANT');
CREATE TYPE "AdCampaignStatus" AS ENUM ('ACTIVE', 'PAUSED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "personalized_picks" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "wishlist_items" ADD COLUMN "price_cents_at_save" INTEGER;
ALTER TABLE "sellers" ADD COLUMN "ad_credit_cents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "shopper_interests" (
    "id" UUID NOT NULL,
    "user_id" UUID,
    "visitor_id" TEXT,
    "source" "ShopperInterestSource" NOT NULL,
    "text" TEXT NOT NULL,
    "category_slug" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopper_interests_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_campaigns" (
    "id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "status" "AdCampaignStatus" NOT NULL DEFAULT 'ACTIVE',
    "suspended_reason" TEXT,
    "daily_budget_cents" INTEGER NOT NULL,
    "bid_cents" INTEGER NOT NULL,
    "ends_on" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_campaign_products" (
    "campaign_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_campaign_products_pkey" PRIMARY KEY ("campaign_id","product_id")
);

CREATE TABLE "ad_clicks" (
    "id" UUID NOT NULL,
    "campaign_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "seller_id" UUID NOT NULL,
    "placement" TEXT NOT NULL,
    "cost_cents" INTEGER NOT NULL,
    "user_id" UUID,
    "visitor_id" TEXT,
    "billed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_clicks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ad_daily_stats" (
    "campaign_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "spend_cents" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ad_daily_stats_pkey" PRIMARY KEY ("campaign_id","product_id","day")
);

-- CreateIndex
CREATE INDEX "shopper_interests_user_id_updated_at_idx" ON "shopper_interests"("user_id", "updated_at");
CREATE INDEX "shopper_interests_visitor_id_updated_at_idx" ON "shopper_interests"("visitor_id", "updated_at");
CREATE INDEX "shopper_interests_created_at_idx" ON "shopper_interests"("created_at");
CREATE INDEX "ad_campaigns_status_idx" ON "ad_campaigns"("status");
CREATE INDEX "ad_campaigns_seller_id_created_at_idx" ON "ad_campaigns"("seller_id", "created_at");
CREATE INDEX "ad_campaign_products_product_id_idx" ON "ad_campaign_products"("product_id");
CREATE INDEX "ad_clicks_seller_id_billed_at_idx" ON "ad_clicks"("seller_id", "billed_at");
CREATE INDEX "ad_clicks_campaign_id_product_id_created_at_idx" ON "ad_clicks"("campaign_id", "product_id", "created_at");
CREATE INDEX "ad_clicks_created_at_idx" ON "ad_clicks"("created_at");
CREATE INDEX "ad_daily_stats_day_idx" ON "ad_daily_stats"("day");

-- AddForeignKey
ALTER TABLE "shopper_interests" ADD CONSTRAINT "shopper_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ad_campaign_products" ADD CONSTRAINT "ad_campaign_products_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_campaign_products" ADD CONSTRAINT "ad_campaign_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ad_clicks" ADD CONSTRAINT "ad_clicks_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ad_daily_stats" ADD CONSTRAINT "ad_daily_stats_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "ad_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;
