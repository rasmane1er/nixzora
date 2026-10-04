import { z } from 'zod';

export const DependencyStatusSchema = z.enum(['up', 'down']);

export const DependencyCheckSchema = z.object({
  status: DependencyStatusSchema,
  latencyMs: z.number().nonnegative(),
  error: z.string().optional(),
});

/**
 * Background jobs (outbox delivery: emails, push, search indexing; sweepers; payouts). They run
 * in the API process ("inline") or in the separate notifications worker ("worker", ADR-0017).
 * Informational: a stalled worker does not take the API out of its load balancer.
 */
export const JobsCheckSchema = z.object({
  mode: z.enum(['inline', 'worker']),
  status: z.enum(['up', 'down', 'unknown']),
  /** When the outbox was last drained. */
  lastRunAt: z.iso.datetime().optional(),
  /** Outbox events waiting to be delivered. */
  backlog: z.number().int().nonnegative(),
  /** Events that failed every retry and need a look. */
  failed: z.number().int().nonnegative(),
  /** Streaming to Kafka (ADR-0020), when KAFKA_BROKERS is set. */
  stream: z
    .object({
      status: z.enum(['up', 'down', 'unknown']),
      /** Events not yet in Kafka. */
      backlog: z.number().int().nonnegative(),
      lastRunAt: z.iso.datetime().optional(),
    })
    .optional(),
});

/** Response of GET /api/v1/health — shared by the API and every client. */
export const HealthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  service: z.literal('nixzora-api'),
  version: z.string(),
  uptimeSeconds: z.number().nonnegative(),
  timestamp: z.iso.datetime(),
  checks: z.object({
    database: DependencyCheckSchema,
    redis: DependencyCheckSchema,
  }),
  /** The read replica (ADR-0022), when configured. Informational: reads fall back to the primary. */
  replica: z
    .object({
      status: z.enum(['up', 'behind', 'down']),
      lagSeconds: z.number().nonnegative().optional(),
    })
    .optional(),
  jobs: JobsCheckSchema.optional(),
});

export type DependencyCheck = z.infer<typeof DependencyCheckSchema>;
export type JobsCheck = z.infer<typeof JobsCheckSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
