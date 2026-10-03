import { Controller, Get, Inject, Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { InternalKeyGuard } from '../common/internal-key.guard';
import { type Env, validateEnv } from '../config/env';
import { LANGUAGE_MODEL, type LanguageModel } from '../modules/assistant/language-model';
import { EMBEDDINGS, type EmbeddingsProvider } from '../modules/ai/embeddings';
import { directEmbeddings, directLanguageModel } from '../modules/ai/providers';
import { AiServiceController } from './ai-service.controller';

/** ECS health check, and which models this service runs (no secrets). */
@Controller()
class HealthController {
  constructor(
    @Inject(LANGUAGE_MODEL) private readonly llm: LanguageModel,
    @Inject(EMBEDDINGS) private readonly embeddings: EmbeddingsProvider,
  ) {}

  @Get('health')
  health() {
    return {
      status: 'ok',
      service: 'ai',
      languageModel: `${this.llm.driver}:${this.llm.model}`,
      embeddings: `${this.embeddings.driver}:${this.embeddings.model}`,
    };
  }
}

/**
 * The AI service (ADR-0016): a stateless gateway to the model providers. No database and no
 * Redis: it holds the provider keys, limits how many calls run at once and checks every caller
 * expects the model it serves. Same image as the API, started with dist/ai-main.js.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => ({
        pinoHttp: {
          level: config.get('LOG_LEVEL', { infer: true }),
          redact: ['req.headers["x-internal-key"]'],
          autoLogging: { ignore: (req) => req.url === '/health' },
        },
      }),
    }),
  ],
  controllers: [AiServiceController, HealthController],
  providers: [
    InternalKeyGuard,
    {
      provide: LANGUAGE_MODEL,
      inject: [ConfigService],
      // Always the provider itself: this service never forwards to another AI service.
      useFactory: (config: ConfigService<Env, true>) => directLanguageModel(config),
    },
    {
      provide: EMBEDDINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => directEmbeddings(config),
    },
  ],
})
export class AiServiceModule {}
