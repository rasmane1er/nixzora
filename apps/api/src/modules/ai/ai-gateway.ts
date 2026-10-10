import { timeDependency } from '../../metrics/metrics';
import { type ProductFacts } from '../insights/product-copy';
import {
  type ExplainInput,
  type ImageInput,
  type ImageQuery,
  type LanguageModel,
  type ReviewSummaryInput,
  type Usage,
} from '../assistant/language-model';
import { type CategoryRef, type ParsedNeed } from '../assistant/need';
import { type Locale } from '../assistant/replies';
import { type EmbeddingPurpose, type EmbeddingsProvider } from './embeddings';

/** The AI service's private routes (ADR-0016), shared by client and server. */
export const AI_ROUTES = {
  understand: '/internal/ai/understand',
  explain: '/internal/ai/explain',
  summarizeReviews: '/internal/ai/summarize-reviews',
  writeProductCopy: '/internal/ai/product-copy',
  embed: '/internal/ai/embed',
  describeImage: '/internal/ai/describe-image',
} as const;

/**
 * Calls the AI service. Every request names the model the caller expects; the service refuses
 * a mismatch (409), so a configuration drift can never write vectors from one model into an
 * index built with another.
 */
export class AiGatewayClient {
  constructor(
    private readonly url: string,
    private readonly key: string,
    private readonly timeoutMs: number,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async post<T>(path: string, body: unknown, timeoutMs = this.timeoutMs): Promise<T> {
    return timeDependency('ai', path, async () => {
      const res = await this.fetchImpl(`${this.url.replace(/\/+$/, '')}${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-internal-key': this.key },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) throw new Error(`AI service answered ${res.status} for ${path}`);
      return (await res.json()) as T;
    });
  }
}

/**
 * A language model behind the AI service. Errors propagate: the assistant and insights already
 * answer with the local driver when a provider call fails.
 */
export class RemoteLanguageModel implements LanguageModel {
  constructor(
    private readonly client: AiGatewayClient,
    readonly driver: LanguageModel['driver'],
    readonly model: string,
  ) {}

  understand(userTurns: string[], categories: CategoryRef[], locale?: Locale) {
    // An AI service that predates `locale` ignores it and answers in English.
    return this.client.post<{ need: ParsedNeed; usage: Usage }>(AI_ROUTES.understand, {
      model: this.model,
      userTurns,
      categories,
      ...(locale ? { locale } : {}),
    });
  }

  explain(input: ExplainInput) {
    return this.client.post<{ text: string; usage: Usage }>(AI_ROUTES.explain, {
      model: this.model,
      input,
    });
  }

  summarizeReviews(input: ReviewSummaryInput) {
    return this.client.post<{ text: string; usage: Usage }>(AI_ROUTES.summarizeReviews, {
      model: this.model,
      input,
    });
  }

  writeProductCopy(facts: ProductFacts) {
    return this.client.post<{ text: string; usage: Usage }>(AI_ROUTES.writeProductCopy, {
      model: this.model,
      input: facts,
    });
  }

  describeImage(input: ImageInput) {
    return this.client.post<{ looksFor: ImageQuery | null; usage: Usage }>(
      AI_ROUTES.describeImage,
      { model: this.model, input },
    );
  }
}

/** Embeddings behind the AI service. Errors propagate (search degrades to keywords). */
export class RemoteEmbeddings implements EmbeddingsProvider {
  /** Tokens used by the last call, for the AI usage log. */
  lastTokens = 0;

  constructor(
    private readonly client: AiGatewayClient,
    readonly driver: EmbeddingsProvider['driver'],
    readonly model: string,
  ) {}

  async embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]> {
    if (!texts.length) return [];
    // Indexing batches can be large; a whole-catalog rebuild must not time out per call.
    const res = await this.client.post<{ vectors: number[][]; tokens: number }>(
      AI_ROUTES.embed,
      { model: this.model, texts, purpose },
      purpose === 'document' ? 120_000 : undefined,
    );
    this.lastTokens = res.tokens;
    return res.vectors;
  }
}
