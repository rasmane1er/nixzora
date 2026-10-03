# ADR-0015: Extract search into its own service

- Status: Accepted
- Date: 2026-10-03
- Roadmap: p8-01 (extract the search service)
- Builds on: ADR-0001 (modular monolith), ADR-0009 (hybrid search on pgvector)

## Context

Search is the busiest read path (every storefront query, every assistant turn) and the only
part of the API that calls an embedding model on the request path. Indexing also embeds whole
batches of products after catalog changes or a model switch. Inside the monolith, a reindex or
an embedding provider slowdown competes with checkout for the same CPU, connections and
autoscaling decisions, and search cannot be scaled without scaling everything.

ADR-0001 kept one deployable until a module had a reason to stand alone. Search now has three:
a different load profile, a paid external dependency, and a narrow interface (the catalog and
the assistant only ever ask "is the index ready?" and "rank these products for this query").

## Decision

**A separate service, same codebase and image.** `apps/api/src/search-main.ts` starts a small
Nest application (`SearchServiceModule`) with only configuration, logging, Prisma, Redis and the
search engine. The deploy builds no extra image: ECS runs the API image with the command
`node dist/search-main.js`. One build, one version number, no drift between the code that writes
the index and the code that reads it.

**A narrow private API**, reachable only inside the VPC:

| Route                                 | Purpose                                     |
| ------------------------------------- | ------------------------------------------- |
| `GET /internal/search/ready`          | Is the index built with the current model?  |
| `POST /internal/search/hybrid`        | Ranked product ids for a query (RRF scores) |
| `POST /internal/search/index/:id`     | Re-index one product (catalog events)       |
| `POST /internal/search/reindex?force` | Rebuild (Ops Center button, CLI)            |
| `GET /internal/search/stats`          | Index health                                |
| `GET /health`                         | ECS health check                            |

Every `/internal` call must carry `x-internal-key` (the existing `INTERNAL_API_KEY` secret,
compared in constant time). The service has no load balancer, its own security-group rule
(port 4100 from the apps group only) and a Cloud Map name, `search.<env>.internal`. Staff
permissions stay in the API: `/api/v1/admin/search/*` still requires `catalog.write` and
forwards to the service.

**The API keeps working when search does not.** `SearchIndexService` is the only thing the rest
of the API sees. With `SEARCH_SERVICE_URL` unset it runs the engine in-process (development,
tests, CI and any single-task deployment). With it set, it calls the service with a 1.5 s timeout;
on a failure it returns no ranking, the catalog falls back to its own PostgreSQL keyword search,
and a 30-second circuit breaker stops further calls so a dead service costs one timeout, not one
per request. Indexing calls are not short-circuited: they throw, and the outbox retries them.

**Data ownership.** The service owns `product_search_docs` (it is the only writer) and reads the
catalog tables it indexes. Sharing the database is a deliberate intermediate step: the catalog
stays the source of truth, and when Kafka arrives (p8-04) the service can consume catalog events
from the stream and keep its own copy of what it needs.

## Consequences

- Search scales on its own (Fargate autoscaling on CPU, 1–2 tasks on staging); a large reindex
  no longer slows checkout.
- One more service to run: about one small Fargate task per environment, plus a Cloud Map
  namespace. Turning it off is a one-line Terraform change (remove `search` from `services`).
- Distributed tracing already follows the call (OpenTelemetry instruments `fetch`), so a slow
  search shows up as a span under the storefront request.
- The search e2e suite runs the API and the service side by side, including the service being
  down.
