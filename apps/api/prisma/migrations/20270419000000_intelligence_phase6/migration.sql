-- Phase 6: intelligence layer — search documents with full-text and vector indexes (ADR-0009).

-- pgvector ships with RDS PostgreSQL 16 and the pgvector/pgvector Docker image.
CREATE EXTENSION IF NOT EXISTS vector;

-- One searchable document per product, rebuilt by the indexer from catalog outbox events.
CREATE TABLE "product_search_docs" (
    "product_id" UUID NOT NULL,
    -- Weighted parts: title and brand (A), category and specs (B), description (C).
    "title_text" TEXT NOT NULL,
    "facets_text" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    -- sha256 of the text that was embedded, and the model that embedded it: unchanged rows are skipped.
    "content_hash" TEXT NOT NULL,
    "embedding_model" TEXT NOT NULL,
    "embedding" vector(512),
    "document" tsvector GENERATED ALWAYS AS (
        setweight(to_tsvector('english', "title_text"), 'A') ||
        setweight(to_tsvector('english', "facets_text"), 'B') ||
        setweight(to_tsvector('english', "body_text"), 'C')
    ) STORED,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_search_docs_pkey" PRIMARY KEY ("product_id")
);

CREATE INDEX "product_search_docs_document_idx" ON "product_search_docs" USING GIN ("document");
CREATE INDEX "product_search_docs_embedding_idx" ON "product_search_docs" USING hnsw ("embedding" vector_cosine_ops);

ALTER TABLE "product_search_docs" ADD CONSTRAINT "product_search_docs_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every paid or local model call, for the AI operations panel and the daily spend cap.
CREATE TABLE "ai_requests" (
    "id" UUID NOT NULL,
    "feature" TEXT NOT NULL,
    "driver" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "input_tokens" INTEGER NOT NULL DEFAULT 0,
    "output_tokens" INTEGER NOT NULL DEFAULT 0,
    -- Estimated cost in millionths of a US dollar, so small calls do not round to zero.
    "cost_micros" INTEGER NOT NULL DEFAULT 0,
    "latency_ms" INTEGER NOT NULL,
    "grounded" BOOLEAN,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_requests_created_at_idx" ON "ai_requests"("created_at");
CREATE INDEX "ai_requests_feature_created_at_idx" ON "ai_requests"("feature", "created_at");
