# ADR-0009: AI layer — semantic search on pgvector and swappable model providers

- Status: Accepted
- Date: 2027-04-19
- Supersedes: the "OpenSearch in Phase 6" note in ADR-0005

## Context

Phase 6 adds the intelligence layer: semantic search, a shopping assistant that answers
requests like "a quiet laptop for coding under $1,500", product enrichment, review summaries and
recommendations. Its exit criterion is that the laptop query returns a grounded, comparable
shortlist.

The constraints:

- One part-time developer and a small budget. Staging already costs about $3–4 a day; an
  OpenSearch domain adds at least ~$25/month before it holds a single product.
- The catalog is small (hundreds, later thousands of products) and already lives in PostgreSQL.
- Model APIs cost money per call and need keys the project may not have yet. Development, CI
  and the public demo must work **without any key and without network access to a model**.
- An assistant that recommends products must never invent one, or a price, or stock.

## Decision

### Search: PostgreSQL + pgvector, hybrid ranking

- A `product_search_docs` table holds one row per product: the text that is searched, a
  generated weighted `tsvector` (GIN index) and a `vector(512)` embedding (HNSW index,
  cosine distance). RDS PostgreSQL 16 ships the `vector` extension.
- The indexer rebuilds a product's row from the `catalog.product.created` / `.updated` outbox
  events, and a full reindex runs on demand (admin button, `pnpm search:reindex`). Rows store a
  hash of their text and the embedding model, so unchanged products are skipped and a model
  change re-embeds everything.
- Queries run both retrievers and merge them with **reciprocal rank fusion**
  (score = Σ 1 / (60 + rank)). Keyword search keeps exact matches (SKUs, model names) on top;
  vectors catch meaning ("quiet" ≈ "low noise", "for flights" ≈ "noise cancelling").
- OpenSearch stays the path for scale (ADR to follow in Phase 8 if the catalog or query volume
  outgrows one Postgres instance). The search code sits behind `SearchIndexService`, so the
  storefront and the assistant do not change when that happens.

### Models: providers behind interfaces, a free local driver by default

| Concern    | Interface            | Drivers                                                                                                                                                                                            |
| ---------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Embeddings | `EmbeddingsProvider` | `local` (default): deterministic hashed n-grams with a shopping synonym map, 512 dims, no network. `voyage`: Voyage AI `voyage-4-lite`, 512 dims (`output_dimension`), `input_type` query/document |
| Language   | `LanguageModel`      | `local` (default): rule-based need parser and template answers. `anthropic`: Claude (default model `claude-haiku-4-5`, configurable) with tool use                                                 |

Drivers are chosen with `EMBEDDINGS_DRIVER` and `AI_DRIVER`. Switching staging to the real
models is a configuration change plus two secrets (`VOYAGE_API_KEY`, `ANTHROPIC_API_KEY`).

### Assistant: retrieval first, the model never writes facts

1. **Understand** the request into a structured need: category, budget, must-haves,
   nice-to-haves, keywords (local parser or Claude with a JSON tool schema).
2. **Retrieve** candidates with hybrid search plus hard filters (price, stock, category) in SQL.
3. **Rank and compare** in code: specs from `products.attributes`, live prices and stock from
   the database.
4. **Explain**: the model writes the short explanation, but every product card, price and stock
   label shown to the shopper comes from the database. Product references in the model's text
   are validated against the retrieved set; anything else is dropped (grounding guardrail).
5. **Act only with consent**: the assistant suggests "Add to cart"; the client calls the normal
   cart API when the shopper taps it. The model has no write tools.

Guardrails: per-request token caps, a per-IP rate limit on the assistant route, a daily spend
cap for paid drivers (falls back to the local driver when reached), prompt-injection hygiene
(catalog text is passed as data, never as instructions), and an evaluation set
(`apps/api/eval/assistant.jsonl`) run in CI with the local driver.

## Consequences

- No new infrastructure or monthly cost; search stays in one transactional store, so a price
  change is searchable as soon as the outbox processes it.
- The local drivers are much weaker than real models, but they keep every feature, test and
  demo working offline. Quality numbers in the evaluation report state which driver produced
  them.
- pgvector HNSW is fine to millions of rows; past that, or for typo tolerance and faceting at
  scale, OpenSearch returns as a dedicated search service.
- Paid model calls are logged with tokens, latency and estimated cost for the AI operations
  panel (p6-09).
