// Must be the first import: tracing patches modules as they load.
import './tracing';
import 'reflect-metadata';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { Logger } from 'nestjs-pino';
import { AiServiceModule } from './ai-service/ai-service.module';
import { type Env } from './config/env';

/** Starts the AI service (ADR-0016): node dist/ai-main.js */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AiServiceModule, {
    bufferLogs: true,
  });
  app.useLogger(app.get(Logger));
  app.use(helmet());
  // Indexing sends up to 1,000 product texts in one call.
  app.useBodyParser('json', { limit: '4mb' });
  app.enableShutdownHooks();
  const config = app.get<ConfigService<Env, true>>(ConfigService);
  if (!config.get('INTERNAL_API_KEY', { infer: true })) {
    throw new Error('INTERNAL_API_KEY is required: the AI service answers only internal callers.');
  }
  if (config.get('AI_SERVICE_URL', { infer: true })) {
    throw new Error('AI_SERVICE_URL must not be set on the AI service itself.');
  }
  const port = config.get('AI_PORT', { infer: true });
  await app.listen(port);
  app.get(Logger).log(`NIXZORA AI service listening on :${port}`);
}

void bootstrap();
