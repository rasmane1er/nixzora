-- Product videos (p10-28, ADR-0050): YouTube and Vimeo links on listings.
CREATE TYPE "VideoProvider" AS ENUM ('YOUTUBE', 'VIMEO');

CREATE TABLE "product_videos" (
    "id" UUID NOT NULL,
    "product_id" UUID NOT NULL,
    "provider" "VideoProvider" NOT NULL,
    "video_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "thumbnail_url" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_videos_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "product_videos_product_id_provider_video_id_key"
  ON "product_videos"("product_id", "provider", "video_id");
CREATE INDEX "product_videos_product_id_idx" ON "product_videos"("product_id");
ALTER TABLE "product_videos" ADD CONSTRAINT "product_videos_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
