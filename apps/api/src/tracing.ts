/**
 * OpenTelemetry tracing. Imported first by main.ts so instrumentation patches
 * http, express, pg and ioredis before anything else loads them.
 *
 * Off unless OTEL_EXPORTER_OTLP_ENDPOINT is set, so there is zero overhead by default.
 * Locally: `pnpm obs:up`, set OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318,
 * then open Jaeger at http://localhost:16686.
 */
import 'dotenv/config';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { ExpressInstrumentation } from '@opentelemetry/instrumentation-express';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { NestInstrumentation } from '@opentelemetry/instrumentation-nestjs-core';
import { PgInstrumentation } from '@opentelemetry/instrumentation-pg';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

export function startTracing(env: NodeJS.ProcessEnv = process.env): NodeSDK | null {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT) return null;

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME ?? 'nixzora-api',
      [ATTR_SERVICE_VERSION]: env.APP_VERSION ?? '0.3.0',
      'deployment.environment.name': env.NODE_ENV ?? 'development',
    }),
    // Reads OTEL_EXPORTER_OTLP_ENDPOINT and appends /v1/traces.
    traceExporter: new OTLPTraceExporter(),
    instrumentations: [
      new HttpInstrumentation({
        // Health probes run every few seconds in production; they would drown real traffic.
        ignoreIncomingRequestHook: (req) => req.url?.startsWith('/api/v1/health') ?? false,
      }),
      new ExpressInstrumentation(),
      new NestInstrumentation(),
      // Records SQL shape, never parameter values (they can contain personal data).
      new PgInstrumentation({ enhancedDatabaseReporting: false }),
      new IORedisInstrumentation(),
    ],
  });

  sdk.start();
  process.once('SIGTERM', () => void sdk.shutdown());
  return sdk;
}

startTracing();
