-- Delivery tracking (p10-04), review photos and helpful votes, product questions (p10-05),
-- back-in-stock and price-drop alerts (p10-06).

-- CreateEnum
CREATE TYPE "QuestionStatus" AS ENUM ('PUBLISHED', 'HIDDEN');
CREATE TYPE "ProductAlertKind" AS ENUM ('BACK_IN_STOCK', 'PRICE_DROP');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "stock_alerts" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "reviews" ADD COLUMN "helpful_count" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "shipment_trackers" (
    "tracking_number" TEXT NOT NULL,
    "carrier" TEXT,
    "estimated_delivery_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipment_trackers_pkey" PRIMARY KEY ("tracking_number")
);

CREATE TABLE "shipment_events" (
    "id" UUID NOT NULL,
    "tracking_number" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT,
    "occurred_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shipment_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "review_photos" (
    "id" UUID NOT NULL,
    "review_id" UUID NOT NULL,
    "storage_key" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_photos_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "review_votes" (
    "review_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_votes_pkey" PRIMARY KEY ("review_id","user_id")
);

CREATE TABLE "product_questions" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "answer_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_questions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_answers" (
    "id" UUID NOT NULL,
    "question_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "QuestionStatus" NOT NULL DEFAULT 'PUBLISHED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_answers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "product_alerts" (
    "user_id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "kind" "ProductAlertKind" NOT NULL,
    "price_cents" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_alerts_pkey" PRIMARY KEY ("user_id","product_id","kind")
);

-- CreateIndex
CREATE INDEX "shipment_events_tracking_number_occurred_at_idx" ON "shipment_events"("tracking_number", "occurred_at");
CREATE UNIQUE INDEX "shipment_events_tracking_number_occurred_at_status_key" ON "shipment_events"("tracking_number", "occurred_at", "status");
CREATE INDEX "review_photos_review_id_position_idx" ON "review_photos"("review_id", "position");
CREATE INDEX "product_questions_product_id_status_created_at_idx" ON "product_questions"("product_id", "status", "created_at");
CREATE INDEX "product_questions_created_at_idx" ON "product_questions"("created_at");
CREATE INDEX "product_answers_question_id_created_at_idx" ON "product_answers"("question_id", "created_at");
CREATE INDEX "product_alerts_kind_product_id_idx" ON "product_alerts"("kind", "product_id");

-- AddForeignKey
ALTER TABLE "review_photos" ADD CONSTRAINT "review_photos_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "review_votes" ADD CONSTRAINT "review_votes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_questions" ADD CONSTRAINT "product_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_answers" ADD CONSTRAINT "product_answers_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "product_questions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_answers" ADD CONSTRAINT "product_answers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_alerts" ADD CONSTRAINT "product_alerts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_alerts" ADD CONSTRAINT "product_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
