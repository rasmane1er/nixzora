# ADR-0020: Event streaming with Kafka (Amazon MSK), fed by the outbox

- Status: Accepted
- Date: 2026-10-05
- Roadmap: p8-04 (Kafka on Amazon MSK, fed by the outbox)
- Builds on: ADR-0006 (transactional outbox), ADR-0015 (search service), ADR-0017 (notifications
  worker)

## Context

Every state change that other parts of the system care about (an order paid or shipped, a
product edited, a return approved, a seller order created…) is written to `outbox_events` in
the same transaction as the change. The notifications worker delivers those rows to in-process
handlers: emails, push, search indexing, review insights. Two limits remain:

- Only code inside the API image can react to an event, and only to the types it registered.
  Analytics, a data warehouse or a future service cannot subscribe.
- The search service is told about product changes by the worker over HTTP, so indexing depends
  on the worker and the API image knowing the search service's address.

## Decision

**Stream every outbox event to Kafka.** With `KAFKA_BROKERS` set, `OutboxStreamer` (in the
worker, where background jobs run) claims rows with `streamed_at IS NULL` using
`FOR UPDATE SKIP LOCKED`, sends them, and sets `streamed_at` only after Kafka acknowledged them
(idempotent producer, `acks=all`). Streaming is independent of in-process delivery
(`published_at`): emails and push work exactly as before, Kafka or not.

| Choice            | Decision                                                                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Topics            | One per aggregate: `nixzora.order.events`, `nixzora.product.events`, `nixzora.return.events`, `nixzora.seller-order.events`…                |
| Key               | The aggregate id, so one order's events land on one partition, in order                                                                     |
| Value             | JSON `{ id, type, aggregateType, aggregateId, occurredAt, payload }`; headers `event-id`, `event-type`, `content-type`                      |
| Delivery          | At least once. A crash between "Kafka acknowledged" and "row marked" resends the batch; consumers skip duplicates by `event-id`             |
| Topic creation    | By the app (`auto.create.topics.enable=false`), 3 partitions, replication factor 2 on MSK                                                   |
| History           | Rows written before this change are marked streamed by the migration: turning Kafka on starts with new events                               |
| Health            | `jobs.stream` in `GET /api/v1/health`: backlog of unstreamed events and the last successful run                                             |
| Kafka unreachable | Rows wait in the table; the streamer backs off (up to a minute) and catches up when Kafka returns. Nothing is lost, nothing blocks checkout |

**Search follows the product topic.** With `SEARCH_INDEX_EVENTS=kafka`, the worker stops
calling the search service for product changes, and the process that owns the index (the search
service, or the worker when search runs in-process) consumes `nixzora.product.events` in the
`nixzora-search-indexer` group. A product that fails three times goes to
`nixzora.product.events.dlq` with the error in a header, and the consumer moves on; the next
full reindex (at start-up) catches it. `outbox` stays the default, so nothing changes until
Kafka is on.

**Amazon MSK, off by default.** `event_streaming = { enabled = true }` creates a provisioned
MSK cluster (Kafka 3.6, one `kafka.t3.small` broker per availability zone, 20 GB each) in the
private subnets: TLS only, IAM authentication (the ECS task roles, so there are no Kafka
passwords to rotate), reachable only from the app tasks on port 9098, logs in CloudWatch. The
worker and API role may create, write and read `nixzora.*` topics; the search role may read and
write (dead letters) them and use its consumer group. Two small brokers cost about 70 USD a
month, so staging keeps it off until there is something to consume.

**Why not MSK Serverless or SQS/SNS/EventBridge?** MSK Serverless bills per cluster-hour
(about 0.75 USD) plus partitions, which is more than provisioned brokers at this size. SNS/SQS
or EventBridge would be cheaper at low volume but give no replay, no per-key ordering and no
standard consumer ecosystem (Kafka Connect, warehouses, stream processors), which is the point
of this phase. The outbox keeps the producer side broker-agnostic either way.

**Local and CI.** `pnpm events:up` starts a single-node Apache Kafka (`apache/kafka-native`) on
`localhost:9092`; CI runs the same image as a service and an end-to-end test sends outbox events
through a real broker and reads them back in order. Without `KAFKA_BROKERS` the app behaves as
before, so day-to-day development needs no broker.

## Consequences

- Any number of consumers can subscribe to the business events without changing the API, and
  can replay a week of history (retention 168 hours).
- Each event is written to PostgreSQL first, then to Kafka: Kafka is a feed, not the system of
  record. Losing the cluster loses no data; the outbox resends anything unacknowledged.
- `outbox_events` grows by one column; old rows are not cleaned up yet (a retention job is a
  follow-up, together with the in-process `published_at`).
- One more managed service to watch when on: the health check's `jobs.stream.backlog` and the
  MSK broker logs are the first places to look (runbook: `docs/runbooks/event-streaming.md`).
