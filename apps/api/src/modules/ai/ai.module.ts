import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import {
  AnthropicLanguageModel,
  LANGUAGE_MODEL,
  LocalLanguageModel,
} from '../assistant/language-model';
import { AiAdminController } from './ai-admin.controller';
import { EmbeddingsModule } from './embeddings.module';

/** Model providers, chosen by configuration (ADR-0009). */
@Module({
  imports: [EmbeddingsModule],
  controllers: [AiAdminController],
  providers: [
    {
      provide: LANGUAGE_MODEL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('AI_DRIVER', { infer: true }) === 'anthropic'
          ? new AnthropicLanguageModel(
              config.get('ANTHROPIC_API_KEY', { infer: true })!,
              config.get('AI_MODEL', { infer: true }),
            )
          : new LocalLanguageModel(),
    },
  ],
  exports: [EmbeddingsModule, LANGUAGE_MODEL],
})
export class AiModule {}
