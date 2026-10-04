// Must be the first import: tracing patches modules as they load.
import './tracing';
// Labels this process's metrics (ADR-0023).
process.env.NIXZORA_PROCESS = 'search';
import 'reflect-metadata';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { httpMetricsMiddleware } from './metrics/metrics';
import { Logger } from 'nestjs-pino';
import { type Env } from './config/env';
import { SearchServiceModule } from './search-service/search-service.module';

/** Starts the search service (ADR-0015): node dist/search-main.js */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(SearchServiceModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.use(httpMetricsMiddleware);
  app.use(helmet());
  app.useBodyParser('json', { limit: '16kb' });
  app.enableShutdownHooks();
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  if (!config.get('INTERNAL_API_KEY', { infer: true })) {
    throw new Error('INTERNAL_API_KEY is required: the search service answers only the API.');
  }
  const port = config.get('SEARCH_PORT', { infer: true });
  await app.listen(port);
  app.get(Logger).log(`NIXZORA search service listening on :${port}`);
}

void bootstrap();
