# ADR-0005: Product media storage and catalog search

- Status: Accepted
- Date: 2026-11-16

## Context

Phase 2 needs product images that staff can upload from the Ops Center, and a catalog search that works before the AI layer and OpenSearch arrive in Phase 6. The project is built by one person part-time, so each choice must run on a laptop with `docker compose` and move to AWS without a rewrite.

## Decision

### Media

- Browsers upload images **directly to storage** with a short-lived, single-object link. The API never streams large files on the request path in production.
- A `StorageService` hides two drivers:
  - `local` (development): the API signs a link with HMAC-SHA256 (`MEDIA_SIGNING_SECRET`), receives the PUT, checks magic bytes and writes the file once (`wx`) under `apps/api/storage`. Files are served from `/api/v1/media/products/...`.
  - `s3` (production, required when `NODE_ENV=production`): a presigned S3 PUT; CloudFront serves files from `ASSETS_BASE_URL`.
- Keys are chosen by the server: `products/YYYY/MM/<uuid>.<ext>`. Clients never pick paths.
- Images are attached to a product in a second call, so an abandoned upload never shows on the store.

### Search

- Phase 2 uses **PostgreSQL full-text search** computed on the fly: `websearch_to_tsquery` over a weighted document (title A, brand and category B, description C), with an `ILIKE` fallback for short or partial words.
- Filters (category subtree, brand, price, in stock) and sorting are applied to at most 2,000 ranked candidates.
- No search index table yet: the catalog is small, and an index would be replaced by OpenSearch in Phase 6. A GIN index on a generated `tsvector` column is the first step if latency grows before then.

## Consequences

- Local development needs no cloud account; production needs one S3 bucket and a CloudFront distribution (Terraform in P4).
- Image processing (resizing, stripping EXIF) is not done yet; it moves to a background worker in P4.
- Search quality is good for exact and keyword queries but has no typo tolerance or synonyms until OpenSearch (P6).
