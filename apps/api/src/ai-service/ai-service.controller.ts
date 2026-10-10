import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpException,
  HttpStatus,
  Inject,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LOCALES } from '@nixzora/i18n';
import { z } from 'zod';
import { InternalKeyGuard } from '../common/internal-key.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { type Env } from '../config/env';
import { LANGUAGE_MODEL, type LanguageModel } from '../modules/assistant/language-model';
import { AI_ROUTES } from '../modules/ai/ai-gateway';
import { EMBEDDINGS, type EmbeddingsProvider } from '../modules/ai/embeddings';
import { ConcurrencyLimit, QueueFullError } from './concurrency';

const model = z.string().min(1).max(100);
// Inputs are built by the API from catalog data; the shapes are checked loosely here and in
// full by the provider adapters. Sizes are bounded by the 256 KB body limit.
const UnderstandSchema = z.object({
  model,
  userTurns: z.array(z.string().max(4000)).min(1).max(20),
  categories: z.array(z.object({ slug: z.string(), name: z.string() }).loose()).max(500),
  /** The shopper's language; optional so older API callers keep working. */
  locale: z.enum(LOCALES).default('en'),
});
const InputSchema = z.object({ model, input: z.record(z.string(), z.unknown()) });
const DescribeImageSchema = z.object({
  model,
  input: z.object({
    // At most 512 px JPEG from the API, so well under the AI service's 4 MB body limit.
    jpegBase64: z
      .string()
      .min(16)
      .max(1_500_000)
      .regex(/^[A-Za-z0-9+/]+=*$/),
    categories: z.array(z.object({ slug: z.string(), name: z.string() }).loose()).max(500),
  }),
});
const ClassifyHelpSchema = z.object({
  model,
  input: z.object({
    turns: z.array(z.string().max(1000)).min(1).max(6),
    orders: z
      .array(
        z.object({
          number: z.string().max(20),
          status: z.string().max(30),
          items: z.array(z.string().max(300)).max(3),
        }),
      )
      .max(10),
    locale: z.enum(LOCALES).optional(),
  }),
});
const EmbedSchema = z.object({
  model,
  texts: z.array(z.string().max(20_000)).min(1).max(1000),
  purpose: z.enum(['query', 'document']),
});

/**
 * The AI service's private API (ADR-0016): the only place that calls model providers and holds
 * their keys. Callers keep their own budgets, fallbacks and usage records.
 */
@Controller()
@UseGuards(InternalKeyGuard)
export class AiServiceController {
  private readonly limit: ConcurrencyLimit;

  constructor(
    @Inject(LANGUAGE_MODEL) private readonly llm: LanguageModel,
    @Inject(EMBEDDINGS) private readonly embeddings: EmbeddingsProvider,
    config: ConfigService<Env, true>,
  ) {
    this.limit = new ConcurrencyLimit(config.get('AI_MAX_CONCURRENCY', { infer: true }));
  }

  @Post(AI_ROUTES.understand)
  @HttpCode(200)
  understand(
    @Body(new ZodValidationPipe(UnderstandSchema)) body: z.infer<typeof UnderstandSchema>,
  ) {
    this.expect(body.model, this.llm.model);
    return this.guarded(() =>
      this.llm.understand(
        body.userTurns,
        body.categories as Parameters<LanguageModel['understand']>[1],
        body.locale,
      ),
    );
  }

  @Post(AI_ROUTES.explain)
  @HttpCode(200)
  explain(@Body(new ZodValidationPipe(InputSchema)) body: z.infer<typeof InputSchema>) {
    this.expect(body.model, this.llm.model);
    return this.guarded(() => this.llm.explain(body.input as never));
  }

  @Post(AI_ROUTES.summarizeReviews)
  @HttpCode(200)
  summarizeReviews(@Body(new ZodValidationPipe(InputSchema)) body: z.infer<typeof InputSchema>) {
    this.expect(body.model, this.llm.model);
    return this.guarded(() => this.llm.summarizeReviews(body.input as never));
  }

  @Post(AI_ROUTES.writeProductCopy)
  @HttpCode(200)
  writeProductCopy(@Body(new ZodValidationPipe(InputSchema)) body: z.infer<typeof InputSchema>) {
    this.expect(body.model, this.llm.model);
    return this.guarded(() => this.llm.writeProductCopy(body.input as never));
  }

  @Post(AI_ROUTES.describeImage)
  @HttpCode(200)
  describeImage(
    @Body(new ZodValidationPipe(DescribeImageSchema)) body: z.infer<typeof DescribeImageSchema>,
  ) {
    this.expect(body.model, this.llm.model);
    return this.guarded(() => this.llm.describeImage(body.input));
  }

  @Post(AI_ROUTES.classifyHelp)
  @HttpCode(200)
  classifyHelp(
    @Body(new ZodValidationPipe(ClassifyHelpSchema)) body: z.infer<typeof ClassifyHelpSchema>,
  ) {
    this.expect(body.model, this.llm.model);
    return this.guarded(() => this.llm.classifyHelp(body.input));
  }

  @Post(AI_ROUTES.embed)
  @HttpCode(200)
  async embed(@Body(new ZodValidationPipe(EmbedSchema)) body: z.infer<typeof EmbedSchema>) {
    this.expect(body.model, this.embeddings.model);
    const vectors = await this.guarded(() => this.embeddings.embed(body.texts, body.purpose));
    return { vectors, tokens: this.embeddings.lastTokens ?? 0 };
  }

  /** Refuses a caller configured for another model (e.g. half-way through a model change). */
  private expect(requested: string, served: string): void {
    if (requested !== served) {
      throw new ConflictException(`This AI service runs ${served}, not ${requested}.`);
    }
  }

  private async guarded<T>(task: () => Promise<T>): Promise<T> {
    try {
      return await this.limit.run(task);
    } catch (error) {
      if (error instanceof QueueFullError) {
        throw new HttpException(error.message, HttpStatus.TOO_MANY_REQUESTS);
      }
      // Provider failures are reported as a bad gateway; the message never carries the key.
      throw new HttpException('The model provider did not answer.', HttpStatus.BAD_GATEWAY);
    }
  }
}
