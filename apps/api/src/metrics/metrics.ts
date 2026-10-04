import { type NextFunction, type Request, type Response } from 'express';
import { collectDefaultMetrics, Counter, Gauge, Histogram, register } from '@prometheus-io/client';

/**
 * Prometheus metrics (ADR-0023). One registry per process; every series carries `service`
 * (api, worker, search, ai) so dashboards can split or sum them. Served on METRICS_PORT, a port
 * the load balancer never routes to.
 */
export const registry = register;

let started = false;

/** Process metrics (CPU, memory, event loop lag, GC) and the `service` label, once. */
export function initMetrics(service: string): void {
  if (started) return;
  started = true;
  registry.setDefaultLabels({ service });
  collectDefaultMetrics({ register: registry, prefix: 'nixzora_' });
}

/** HTTP requests served, by route pattern (never the raw URL: ids would explode cardinality). */
export const httpRequests = new Histogram({
  name: 'nixzora_http_request_duration_seconds',
  help: 'HTTP requests served, by method, route and status class.',
  labelNames: ['method', 'route', 'status'] as const,
  buckets: [0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

/** Calls to other services and providers (search, AI, Stripe, SES…). */
export const dependencyCalls = new Histogram({
  name: 'nixzora_dependency_request_duration_seconds',
  help: 'Calls to internal services and external providers, by outcome.',
  labelNames: ['dependency', 'operation', 'outcome'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30],
});

/** Business events as the worker delivers them (order paid, cancelled, refunded…). */
export const businessEvents = new Counter({
  name: 'nixzora_business_events_total',
  help: 'Business events delivered from the outbox, by type.',
  labelNames: ['type'] as const,
});

/** Filled in at scrape time by MetricsCollectors (only where there is something to report). */
export const scrapeHooks: { queues?: () => Promise<void>; replica?: () => void } = {};

export const outboxBacklog = new Gauge({
  name: 'nixzora_outbox_backlog',
  help: 'Outbox events waiting: "deliver" for in-process handlers, "stream" for Kafka.',
  labelNames: ['queue'] as const,
  async collect() {
    await scrapeHooks.queues?.();
  },
});
export const outboxFailed = new Gauge({
  name: 'nixzora_outbox_failed',
  help: 'Outbox events that failed every retry.',
});
export const outboxLastRun = new Gauge({
  name: 'nixzora_outbox_last_run_timestamp_seconds',
  help: 'When the outbox was last drained ("deliver") or streamed ("stream").',
  labelNames: ['queue'] as const,
});
export const replicaLag = new Gauge({
  name: 'nixzora_db_replica_lag_seconds',
  help: 'Read replica lag as measured by the API (absent without a replica).',
  // Labelled so nothing is reported until a replica is configured (an unlabelled gauge reads 0).
  labelNames: ['replica'] as const,
  collect() {
    scrapeHooks.replica?.();
  },
});
export const replicaUsable = new Gauge({
  name: 'nixzora_db_replica_usable',
  help: '1 when reads go to the replica, 0 when they fell back to the primary.',
  labelNames: ['replica'] as const,
});

/** Times an async call to a dependency and records its outcome. */
export async function timeDependency<T>(
  dependency: string,
  operation: string,
  call: () => Promise<T>,
): Promise<T> {
  const end = dependencyCalls.startTimer({ dependency, operation });
  try {
    const result = await call();
    // A fetch Response with an error status counts as an error too.
    const failed = (result as { ok?: unknown } | null)?.ok === false;
    end({ outcome: failed ? 'error' : 'ok' });
    return result;
  } catch (error) {
    end({ outcome: 'error' });
    throw error;
  }
}

/** "2xx", "4xx"… */
function statusClass(code: number): string {
  return `${Math.floor(code / 100)}xx`;
}

/**
 * Express middleware recording every request once it finishes. The route is Express's matched
 * pattern ("/api/v1/catalog/products/:slug"); unmatched paths share one "unmatched" label.
 * Health checks and the metrics port are left out.
 */
export function httpMetricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path.endsWith('/health')) return next();
  const end = httpRequests.startTimer();
  res.on('finish', () => {
    const pattern = req.route?.path as string | undefined;
    // Catch-all routes ("/api/{*splat}") answer unknown paths: those share one label too.
    const route = pattern && !pattern.includes('*') ? `${req.baseUrl}${pattern}` : 'unmatched';
    end({ method: req.method, route, status: statusClass(res.statusCode) });
  });
  next();
}
