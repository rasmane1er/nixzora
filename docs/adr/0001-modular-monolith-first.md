# ADR-0001: Start as a modular monolith

- Status: Accepted
- Date: 2026-10-05

## Context

The NIXZORA vision lists about 15 backend services (identity, catalog, inventory, cart, orders, payments, shipping, notifications, search, recommendations, AI, analytics and more), connected by Kafka and running on Kubernetes.

The platform is built by one engineer working about 12 hours a week. Running 15 services from day one means 15 deployables, 15 CI pipelines, distributed tracing just to debug a checkout, network failure handling between every step, and a Kafka and Kubernetes footprint before there is a single customer.

## Decision

Build the backend as **one NestJS application** (`apps/api`) with strict internal module boundaries:

- Each domain is a NestJS module under `src/modules/<domain>` (identity, catalog, inventory, orders, payments, …).
- A module owns its tables. Other modules call its exported service, never its tables or Prisma models directly.
- Cross-module side effects go through the **transactional outbox** (`outbox_events`), written in the same database transaction as the change and processed by BullMQ workers.
- ESLint import rules will enforce module boundaries once the first two domain modules exist.

A module is extracted into its own service only when it needs independent scaling, its own release cadence, or isolation (security or failure). Phase 8 plans the first extractions: search, AI and notifications. At that point the outbox feeds Kafka (Amazon MSK) instead of BullMQ.

## Consequences

- One deployable, one database, simple local development and fast debugging.
- Transactions across modules are possible but discouraged; the outbox keeps modules loosely coupled so extraction later is a mechanical change.
- The original service list is preserved as the module list, so nothing in the vision is lost.
