import { type INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { setInternalApiKey } from './common/request-meta';
import { type Env } from './config/env';
import { IMAGE_TYPES } from './modules/media/image-type';

/** HTTP setup shared by main.ts and the end-to-end tests, so tests exercise the real pipeline. */
export function configureApp(app: INestApplication): void {
  const config = app.get<ConfigService<Env, true>>(ConfigService);

  // Behind the load balancer, req.ip comes from X-Forwarded-For (one trusted hop: the ALB).
  const hops = config.get('TRUST_PROXY_HOPS', { infer: true });
  if (hops > 0) (app as NestExpressApplication).set('trust proxy', hops);
  setInternalApiKey(config.get('INTERNAL_API_KEY', { infer: true }));

  app.use(helmet());
  // Image bodies arrive as raw bytes (local uploads); everything else stays JSON.
  (app as NestExpressApplication).useBodyParser('raw', {
    type: Object.keys(IMAGE_TYPES),
    limit: '10mb',
  });
  app.enableCors({ origin: config.get('CORS_ORIGINS', { infer: true }), credentials: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.enableShutdownHooks();

  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('NIXZORA API')
        .setDescription('AI-native commerce platform API')
        .setVersion(config.get('APP_VERSION', { infer: true }))
        .addBearerAuth()
        .build(),
    );
    SwaggerModule.setup('docs', app, document);
  }
}
