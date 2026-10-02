import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { AiModule } from '../ai/ai.module';
import { CatalogModule } from '../catalog/catalog.module';
import { SearchModule } from '../search/search.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { AnthropicLanguageModel, LANGUAGE_MODEL, LocalLanguageModel } from './language-model';

@Module({
  imports: [AiModule, SearchModule, CatalogModule],
  controllers: [AssistantController],
  providers: [
    AssistantService,
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
})
export class AssistantModule {}
