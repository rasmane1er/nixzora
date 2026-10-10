-- Search by photo (p10-14, ADR-0036): a 64-number colour and layout signature per product image,
-- computed by the API from the image itself (no model, no cost), compared with cosine distance.
ALTER TABLE "product_images"
  ADD COLUMN "visual" vector(64),
  ADD COLUMN "visual_tries" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "product_images_visual_idx" ON "product_images" USING hnsw ("visual" vector_cosine_ops);
-- The indexer's queue: images that still need a signature.
CREATE INDEX "product_images_visual_pending_idx" ON "product_images" ("id") WHERE "visual" IS NULL;
