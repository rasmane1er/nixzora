import { z } from 'zod';

export const DependencyStatusSchema = z.enum(['up', 'down']);

export const DependencyCheckSchema = z.object({
  status: DependencyStatusSchema,
  latencyMs: z.number().nonnegative(),
  error: z.string().optional(),
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
});

export type DependencyCheck = z.infer<typeof DependencyCheckSchema>;
export type HealthResponse = z.infer<typeof HealthResponseSchema>;
