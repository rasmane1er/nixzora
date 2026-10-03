import { type ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import {
  AnthropicLanguageModel,
  type LanguageModel,
  LocalLanguageModel,
} from '../assistant/language-model';
import { type EmbeddingsProvider, LocalEmbeddings, VoyageEmbeddings } from './embeddings';
import { AiGatewayClient, RemoteEmbeddings, RemoteLanguageModel } from './ai-gateway';

type Config = ConfigService<Env, true>;

/** The configured model provider itself (the AI service, or the API with no AI service). */
export function directLanguageModel(config: Config): LanguageModel {
  return config.get('AI_DRIVER', { infer: true }) === 'anthropic'
    ? new AnthropicLanguageModel(
        config.get('ANTHROPIC_API_KEY', { infer: true })!,
        config.get('AI_MODEL', { infer: true }),
      )
    : new LocalLanguageModel();
}

export function directEmbeddings(config: Config): EmbeddingsProvider {
  return config.get('EMBEDDINGS_DRIVER', { infer: true }) === 'voyage'
    ? new VoyageEmbeddings(
        config.get('VOYAGE_API_KEY', { infer: true })!,
        config.get('VOYAGE_MODEL', { infer: true }),
      )
    : new LocalEmbeddings();
}

/**
 * What the API and the search service use (ADR-0016). The free local drivers always run
 * in-process. Paid providers go through the AI service when AI_SERVICE_URL is set, so only that
 * service holds the provider keys; without it they are called directly, as before.
 */
export function languageModelFor(config: Config): LanguageModel {
  const url = config.get('AI_SERVICE_URL', { infer: true });
  if (!url || config.get('AI_DRIVER', { infer: true }) === 'local')
    return directLanguageModel(config);
  return new RemoteLanguageModel(
    gateway(config, url),
    'anthropic',
    config.get('AI_MODEL', { infer: true }),
  );
}

export function embeddingsFor(config: Config): EmbeddingsProvider {
  const url = config.get('AI_SERVICE_URL', { infer: true });
  if (!url || config.get('EMBEDDINGS_DRIVER', { infer: true }) === 'local')
    return directEmbeddings(config);
  return new RemoteEmbeddings(
    gateway(config, url),
    'voyage',
    config.get('VOYAGE_MODEL', { infer: true }),
  );
}

function gateway(config: Config, url: string): AiGatewayClient {
  return new AiGatewayClient(
    url,
    config.get('INTERNAL_API_KEY', { infer: true }) ?? '',
    config.get('AI_SERVICE_TIMEOUT_MS', { infer: true }),
  );
}
