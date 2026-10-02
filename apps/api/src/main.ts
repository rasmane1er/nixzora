// Must be the first import: tracing patches modules as they load.
import './tracing';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { type Env } from './config/env';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true, rawBody: true });
  app.useLogger(app.get(Logger));
  configureApp(app);

  const port = app.get<ConfigService<Env, true>>(ConfigService).get('API_PORT', { infer: true });
  await app.listen(port);
  app.get(Logger).log(`NIXZORA API listening on http://localhost:${port} (docs at /docs)`);
}

void bootstrap();
