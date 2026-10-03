# ADR-0016: An AI service in front of the model providers

- Status: Accepted
- Date: 2026-10-03
- Roadmap: p8-02 (extract the AI service)
- Builds on: ADR-0009 (AI layer), ADR-0011 (review insights and product copy), ADR-0015 (search
  service)

## Context

Three deployables now call paid model APIs: the API (assistant, review summaries, listing
copy) and the search service (query and document embeddings). Each held the Anthropic and
Voyage keys, each could exhaust the provider's rate limit on its own, and a burst of indexing
could starve the assistant. The keys were the most valuable secrets in the API task after the
payment keys, for code paths that never needed them directly.

## Decision

**A small, stateless AI service** (`apps/api/src/ai-main.ts`, the API image started with
`dist/ai-main.js`) is the only place that calls the providers and the only task that receives
`ANTHROPIC_API_KEY` and `VOYAGE_API_KEY`. It has no database or Redis access.

| Route                                 | Purpose                                    |
| ------------------------------------- | ------------------------------------------ |
| `POST /internal/ai/understand`        | Structured shopping need from the dialogue |
| `POST /internal/ai/explain`           | Grounded explanation of the picks          |
| `POST /internal/ai/summarize-reviews` | "What customers say" summary               |
| `POST /internal/ai/product-copy`      | Listing description draft                  |
| `POST /internal/ai/embed`             | Embeddings for queries and documents       |
| `GET /health`                         | ECS health check, model names (no secrets) |

- **Same interfaces, different transport.** `RemoteLanguageModel` and `RemoteEmbeddings`
  implement the existing `LanguageModel` and `EmbeddingsProvider` interfaces, so the assistant,
  insights and search code is unchanged. With `AI_SERVICE_URL` unset (development, tests, CI,
  demo) providers are called directly as before.
- **Free drivers stay local.** The offline `local` language model and embeddings never go over
  the network, even with an AI service configured.
- **The model is part of every request.** Callers state the model they expect; the service
  refuses a mismatch with 409. A half-finished model switch can never write vectors from one
  model into an index built with another.
- **Back-pressure in one place.** At most `AI_MAX_CONCURRENCY` provider calls run at once
  (default 8 per task); a short queue waits, and beyond it callers get 429 at once instead of a
  pile of timeouts.
- **Callers keep their policies.** Budgets, usage records, grounding checks and fallbacks stay
  in the API: when the AI service or a provider fails, the assistant and insights answer with the
  local templates, and search degrades to keyword search, exactly as for a provider outage.
- **Access** is the same as the search service: private DNS `ai.<env>.internal:4200`, a
  security-group rule from the apps group only, and the internal API key on every call.

## Consequences

- The API and search tasks no longer receive the provider keys (Terraform drops them when the
  `ai` service is enabled); rotating a provider key restarts one small service.
- One more small Fargate service; remove `ai` from `services` to go back to direct calls.
- Provider rate limits are shared fairly: indexing and the assistant queue at the same door.
- The AI e2e suite runs the service with the offline drivers and checks that answers through
  it match the in-process provider exactly, plus key and model checks.
