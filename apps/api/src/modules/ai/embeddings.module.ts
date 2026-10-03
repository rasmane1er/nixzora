import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { AiUsageService } from './ai-usage.service';
import { EMBEDDINGS, LocalEmbeddings, VoyageEmbeddings } from './embeddings';

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
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('EMBEDDINGS_DRIVER', { infer: true }) === 'voyage'
          ? new VoyageEmbeddings(
              config.get('VOYAGE_API_KEY', { infer: true })!,
              config.get('VOYAGE_MODEL', { infer: true }),
            )
          : new LocalEmbeddings(),
    },
  ],
  exports: [AiUsageService, EMBEDDINGS],
})
export class EmbeddingsModule {}
