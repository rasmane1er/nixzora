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
import { OutboxService } from '../outbox/outbox.service';
import { REVIEWS_CHANGED } from './events';
import {
  ANALYSIS_VERSION,
  analyzeReviews,
  groundSummary,
  type Theme,
  templateSummary,
} from './review-analysis';
import { runsBackgroundJobs } from '../../common/background-jobs';

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

  async forProduct(slug: string): Promise<ReviewInsights | null> {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: 'ACTIVE' },
      select: { reviewInsight: true },
    });
    if (!product) throw new NotFoundException('We could not find that product.');
    const row = product.reviewInsight;
    if (!row) return null;
    return {
      summary: row.summary,
      pros: row.pros as Theme[],
      cons: row.cons as Theme[],
      reviewCount: row.reviewCount,
      averageRating: row.averageRating,
      positivePercent: row.positivePct,
      aiWritten: row.model !== 'local',
      generatedAt: row.generatedAt.toISOString(),
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
      .update(reviews.map((r) => `${r.id}:${r.updatedAt.toISOString()}`).join('|'))
      .digest('hex');
    if (existing?.inputHash === inputHash) return 'unchanged';

    const { summary, model } = await this.summarize(product!.title, analysis, reviews);
    const data = {
      summary,
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

  private async summarize(
    title: string,
    analysis: NonNullable<ReturnType<typeof analyzeReviews>>,
    reviews: { rating: number; title: string; body: string }[],
  ): Promise<{ summary: string; model: string }> {
    const fallback = { summary: templateSummary(analysis), model: 'local' };
    if (this.llm.driver === 'local' || !(await this.usage.withinBudget())) return fallback;

    const started = Date.now();
    try {
      const { text, usage } = await this.llm.summarizeReviews({
        productTitle: title,
        analysis,
        reviews: reviews.map((r) => ({ rating: r.rating, text: `${r.title}. ${r.body}` })),
      });
      const grounded = groundSummary(text, analysis);
      await this.usage.record({
        feature: 'review_insights',
        driver: this.llm.driver,
        model: this.llm.model,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        latencyMs: Date.now() - started,
        grounded: grounded !== null,
      });
      return grounded ? { summary: grounded, model: this.llm.model } : fallback;
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
