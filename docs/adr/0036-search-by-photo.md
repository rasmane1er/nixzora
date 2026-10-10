# ADR-0036: Search by photo

- Status: accepted
- Date: 2026-10-12

## Context

Tier 3, third part. A shopper who sees something they like (a jacket, a lamp, a pair of shoes)
should be able to snap or upload a picture and find similar products. It has to work, for free,
with the local AI driver used in development and on staging, and get better when a paid model is
switched on.

## Decision

- **A free image signature.** The API computes a 64-number signature for every product image
  with `sharp`: the picture is oriented, flattened onto white and cropped to its subject, then
  described by a 4×4 colour layout (lighting-neutral) and a 16-bin colour histogram. Signatures
  live in `product_images.visual` (pgvector, HNSW index, cosine distance). It is not a learned
  embedding: it matches on colour and rough shape, which brings the right product and its
  look-alikes to the top for clear product photos (on the demo catalog, a cropped, darker JPEG of
  a product finds that product first about 5 times in 6).
- **Indexing.** A background pass every 5 minutes (and 10 seconds after start-up) signs images
  that have none, 50 at a time. Images are read from storage (S3 or the local folder); demo
  illustrations from the storefront. An unreadable image is tried three times, then skipped.
- **Searching.** `POST /catalog/visual-search` takes a base64 photo (the website shrinks it to
  1024 px in the browser); `POST /catalog/visual-search/upload` takes the file's raw bytes (the
  app sends the picked file as it is, up to 10 MB). Both are public and limited to 10 a minute.
  The nearest 400 images are grouped by product; 24 active products come back as cards.
- **A paid model, when there is one.** With `AI_DRIVER=anthropic` and today's AI budget left, the
  photo (re-encoded to 512 px) also goes to the model, which names the product as a search query
  and category through a forced tool call. The text search's results are blended with the
  picture's by reciprocal-rank fusion, and the page offers "Search ‘…’ instead". Calls are
  logged as `photo_search` in the AI usage table. The local driver skips this step.
- **Privacy.** The photo is read and forgotten: it is never written to storage or logs. Only the
  result (product ids, the model's query) is kept in Redis for 30 minutes, so the storefront can
  render it at `/search/photo?r=<id>` and the back button works.
- **Web:** a camera button in the header search box opens `/search/photo`: choose a file (phones
  offer the camera), drop one, or paste one. **App:** a camera button in the search bar and on the
  home screen opens a screen with "Take a photo" and "Choose from library".

## Consequences

- Matching is by look, not by meaning: a red mug can bring up a red kettle. The model's query
  fixes most of that when a paid model is on; a learned image embedding (for example a CLIP model
  in the AI service) is the next step if photo search becomes popular.
- New images are searchable within about 5 minutes of being added.
- The app's camera and photo permission texts now mention photo search; they show from the next
  native build (an over-the-air update keeps the old wording).
