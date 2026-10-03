// Must be the first import: tracing patches modules as they load.
import './tracing';
import './worker/worker-env';
import 'reflect-metadata';
import { createServer } from 'node:http';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { type Env } from './config/env';
import { HealthService } from './health/health.service';

/**
 * Starts the notifications worker (ADR-0017): node dist/worker-main.js
 *
 * Same code and image as the API, without the HTTP API: it drains the transactional outbox
 * (order and return emails, push notifications, seller alerts, search indexing, review insights)
 * and runs the sweepers and payouts. It serves only a health endpoint, on WORKER_PORT, for the
 * container health check. Several workers can run at once: outbox rows are claimed with
 * FOR UPDATE SKIP LOCKED.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  const logger = app.get(Logger);
  app.useLogger(logger);
  app.enableShutdownHooks();

  const health = app.get(HealthService);
  const port = app.get<ConfigService<Env, true>>(ConfigService).get('WORKER_PORT', {
    infer: true,
  });
  const server = createServer((req, res) => {
    if (req.method !== 'GET' || req.url !== '/health') {
      res.writeHead(404).end();
      return;
    }
    void health.check().then((result) => {
      // The worker is healthy when it can reach its stores; job progress is reported, not judged.
      res.writeHead(result.status === 'ok' ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ...result, service: 'nixzora-worker' }));
    });
  });
  server.listen(port);
  process.once('SIGTERM', () => server.close());
  logger.log(`NIXZORA notifications worker running (health on :${port}/health)`);
}

void bootstrap();
