import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { AiUsageService } from './ai-usage.service';
import { EMBEDDINGS } from './embeddings';
import { embeddingsFor } from './providers';

/**
 * The embeddings provider and AI usage log, without any HTTP routes, so the search service
 * (ADR-0015) can use them without exposing the API's admin endpoints.
 */
@Module({
  providers: [
    AiUsageService,
    {
      provide: EMBEDDINGS,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => embeddingsFor(config),
    },
  ],
  exports: [AiUsageService, EMBEDDINGS],
})
export class EmbeddingsModule {}
