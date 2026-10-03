import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  type OnApplicationBootstrap,
  type OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type ReviewInsights } from '@nixzora/validation';
import { createHash } from 'node:crypto';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { AiUsageService } from '../ai/ai-usage.service';
import {
  LANGUAGE_MODEL,
  type LanguageModel,
  LocalLanguageModel,
} from '../assistant/language-model';
import { type Locale } from '../assistant/replies';
import { OutboxService } from '../outbox/outbox.service';
import { REVIEWS_CHANGED } from './events';
import {
  ANALYSIS_VERSION,
  analyzeReviews,
  groundSummary,
  type Theme,
  templateSummary,
  themeLabel,
} from './review-analysis';
import { runsBackgroundJobs } from '../../common/background-jobs';

/** Languages besides English that get their own model-written summary. */
const TRANSLATED: Exclude<Locale, 'en'>[] = ['fr', 'es'];

/** Model-written summaries in other languages, stored next to the English one. */
type Summaries = Partial<Record<Exclude<Locale, 'en'>, string>>;

/**
 * Keeps each product's "what customers say" current (p6-04). The analysis is computed from the
 * review text; a paid model (when configured and within budget) may only reword the summary
 * sentence, and its text is discarded unless every number in it is one we computed.
 */
@Injectable()
export class ReviewInsightsService implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(ReviewInsightsService.name);
  private readonly local = new LocalLanguageModel();

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly usage: AiUsageService,
    @Inject(LANGUAGE_MODEL) private readonly llm: LanguageModel,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    this.outbox.on(REVIEWS_CHANGED, async (event) => {
      await this.refresh(event.aggregateId);
    });
  }

  onApplicationBootstrap(): void {
    if (!runsBackgroundJobs(this.config)) return;
    // Picks up a new analysis version or model; unchanged products are skipped by their hash.
    void this.refreshAll()
      .then(({ updated, scanned }) => {
        if (updated) this.logger.log(`Review insights: ${updated} of ${scanned} products updated`);
      })
      .catch((error: Error) =>
        this.logger.error(`Review insights refresh failed: ${error.message}`),
      );
  }

  /**
   * The insights in the reader's language. English is stored as written. Other languages read
   * the model's summary stored for them at refresh time, or else the template summary written
   * from the stored counts; theme labels are translated from a fixed list. No model call here.
   */
  async forProduct(slug: string, locale: Locale = 'en'): Promise<ReviewInsights | null> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { reviewInsight: true },
    });
    if (!product) throw new NotFoundException('We could not find that product.');
    const row = product.reviewInsight;
    if (!row) return null;
    const pros = row.pros as Theme[];
    const cons = row.cons as Theme[];
    const insights: ReviewInsights = {
      summary: row.summary,
      pros,
      cons,
      reviewCount: row.reviewCount,
      averageRating: row.averageRating,
      positivePercent: row.positivePct,
      aiWritten: row.model !== 'local',
      generatedAt: row.generatedAt.toISOString(),
    };
    if (locale === 'en') return insights;

    const written = row.model !== 'local' ? (row.summaries as Summaries)[locale] : undefined;
    const localize = (themes: Theme[]) =>
      themes.map((theme) => ({ ...theme, label: themeLabel(theme.label, locale) }));
    return {
      ...insights,
      summary:
        written ??
        templateSummary(
          {
            reviewCount: row.reviewCount,
            averageRating: row.averageRating,
            positivePercent: row.positivePct,
            pros,
            cons,
          },
          locale,
        ),
      pros: localize(pros),
      cons: localize(cons),
      aiWritten: Boolean(written),
    };
  }

  /**
   * Rebuilds one product's insights from its approved reviews. Returns "unchanged" when the
   * reviews are the same as last time, "removed" when there are too few to summarize.
   */
  async refresh(productId: string): Promise<'updated' | 'unchanged' | 'removed'> {
    const [product, reviews, existing] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId }, select: { title: true } }),
      this.prisma.review.findMany({
        where: { productId, status: 'APPROVED' },
        select: { id: true, rating: true, title: true, body: true, updatedAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reviewInsight.findUnique({ where: { productId }, select: { inputHash: true } }),
    ]);
    const analysis = product ? analyzeReviews(reviews) : null;
    if (!analysis) {
      if (!existing) return 'unchanged';
      await this.prisma.reviewInsight.delete({ where: { productId } });
      return 'removed';
    }

    const inputHash = createHash('sha256')
      .update(`v${ANALYSIS_VERSION}:${this.llm.model}|`)
      // Model-written summaries are also stored in French and Spanish: rows written before
      // that are rebuilt once. Template rows are translated when read, so their hash is as before.
      .update(this.llm.driver === 'local' ? '' : `${TRANSLATED.join(',')}|`)
      .update(reviews.map((r) => `${r.id}:${r.updatedAt.toISOString()}`).join('|'))
      .digest('hex');
    if (existing?.inputHash === inputHash) return 'unchanged';

    const { summary, model, summaries } = await this.summarize(product!.title, analysis, reviews);
    const data = {
      summary,
      summaries,
      pros: analysis.pros,
      cons: analysis.cons,
      reviewCount: analysis.reviewCount,
      averageRating: analysis.averageRating,
      positivePct: analysis.positivePercent,
      model,
      inputHash,
      generatedAt: new Date(),
    };
    await this.prisma.reviewInsight.upsert({
      where: { productId },
      create: { productId, ...data },
      update: data,
    });
    return 'updated';
  }

  /** Rebuilds every product that has reviews (admin "refresh", seeds, a new model). */
  async refreshAll(): Promise<{ updated: number; scanned: number }> {
    const rows = await this.prisma.review.groupBy({
      by: ['productId'],
      where: { status: 'APPROVED' },
    });
    let updated = 0;
    for (const { productId } of rows) {
      if ((await this.refresh(productId)) === 'updated') updated++;
    }
    return { updated, scanned: rows.length };
  }

  /**
   * The English summary, then (only when a model wrote or tried to write it) one per other
   * language: a bounded few calls per review change, never per page view. A language whose
   * text fails the guardrail is left out and readers get the translated template instead.
   */
  private async summarize(
    title: string,
    analysis: NonNullable<ReturnType<typeof analyzeReviews>>,
    reviews: { rating: number; title: string; body: string }[],
  ): Promise<{ summary: string; model: string; summaries: Summaries }> {
    const english = await this.summarizeIn('en', title, analysis, reviews);
    const summaries: Summaries = {};
    if (english.attempted) {
      for (const locale of TRANSLATED) {
        const translated = await this.summarizeIn(locale, title, analysis, reviews);
        if (!translated.attempted) break;
        if (translated.model !== 'local') summaries[locale] = translated.summary;
      }
    }
    return { summary: english.summary, model: english.model, summaries };
  }

  /** One language's summary. `attempted` is false when no model call was made or it failed. */
  private async summarizeIn(
    locale: Locale,
    title: string,
    analysis: NonNullable<ReturnType<typeof analyzeReviews>>,
    reviews: { rating: number; title: string; body: string }[],
  ): Promise<{ summary: string; model: string; attempted: boolean }> {
    const fallback = { summary: templateSummary(analysis), model: 'local', attempted: false };
    if (this.llm.driver === 'local' || !(await this.usage.withinBudget())) return fallback;

    const started = Date.now();
    try {
      const { text, usage } = await this.llm.summarizeReviews({
        productTitle: title,
        analysis,
        reviews: reviews.map((r) => ({ rating: r.rating, text: `${r.title}. ${r.body}` })),
        // English requests stay exactly as before (no locale field).
        ...(locale === 'en' ? {} : { locale }),
      });
      const grounded = groundSummary(text, analysis, locale);
      await this.usage.record({
        feature: 'review_insights',
        driver: this.llm.driver,
        model: this.llm.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs: Date.now() - started,
        grounded: grounded !== null,
      });
      return grounded
        ? { summary: grounded, model: this.llm.model, attempted: true }
        : { ...fallback, attempted: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Review summary fell back to the template: ${message}`);
      await this.usage.record({
        feature: 'review_insights',
        driver: this.llm.driver,
        model: this.llm.model,
        latencyMs: Date.now() - started,
        error: message.slice(0, 200),
      });
      return fallback;
    }
  }
}
