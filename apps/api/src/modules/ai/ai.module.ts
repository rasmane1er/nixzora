import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { LANGUAGE_MODEL } from '../assistant/language-model';
import { AiAdminController } from './ai-admin.controller';
import { EmbeddingsModule } from './embeddings.module';
import { languageModelFor } from './providers';

/** Model providers, chosen by configuration (ADR-0009). */
@Module({
  imports: [EmbeddingsModule],
  controllers: [AiAdminController],
  providers: [
    {
      provide: LANGUAGE_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => languageModelFor(config),
    },
  ],
  exports: [EmbeddingsModule, LANGUAGE_MODEL],
})
export class AiModule {}
