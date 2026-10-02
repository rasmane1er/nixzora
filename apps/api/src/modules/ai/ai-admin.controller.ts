import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiTags } from '@nestjs/swagger';
import { type AiUsageReport, AiUsageReportSchema } from '@nixzora/validation';
import { ApiZodResponse } from '../../common/api-docs';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../identity/guards/decorators';
import { AiUsageService } from './ai-usage.service';
import { EMBEDDINGS, type EmbeddingsProvider } from './embeddings';

const usd = (micros: number | bigint | null) => Math.round(Number(micros ?? 0) / 100) / 10_000;
const int = (value: number | bigint | null) => (value === null ? null : Math.round(Number(value)));

/** Ops Center: what the AI layer costs, how fast it is and whether its answers stay grounded. */
@ApiTags('admin')
@RequirePermissions('admin.access')
@Controller({ path: 'admin/ai', version: '1' })
export class AiAdminController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly usage: AiUsageService,
    private readonly config: ConfigService<Env, true>,
    @Inject(EMBEDDINGS) private readonly embeddings: EmbeddingsProvider,
  ) {}

  @Get('usage')
  @ApiZodResponse(AiUsageReportSchema)
  async report(@Query('days') daysParam?: string): Promise<AiUsageReport> {
    const days = Math.min(90, Math.max(1, Number(daysParam) || 14));
    const since = new Date(Date.now() - days * 86_400_000);

    const [daily, byFeature, totals, errors, spentToday] = await Promise.all([
      this.prisma.$queryRaw<
        { day: string; requests: bigint; cost: bigint; errors: bigint; latency: number | null }[]
      >`
        SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS day,
               count(*) AS requests, coalesce(sum(cost_micros), 0) AS cost,
               count(*) FILTER (WHERE error IS NOT NULL) AS errors,
               avg(latency_ms)::float AS latency
        FROM ai_requests WHERE created_at >= ${since}
        GROUP BY 1 ORDER BY 1`,
      this.prisma.$queryRaw<
        {
          feature: string;
          driver: string;
          model: string;
          requests: bigint;
          input: bigint;
          output: bigint;
          cost: bigint;
          latency: number | null;
        }[]
      >`
        SELECT feature, driver, model, count(*) AS requests,
               coalesce(sum(input_tokens), 0) AS input, coalesce(sum(output_tokens), 0) AS output,
               coalesce(sum(cost_micros), 0) AS cost, avg(latency_ms)::float AS latency
        FROM ai_requests WHERE created_at >= ${since}
        GROUP BY 1, 2, 3 ORDER BY requests DESC`,
      this.prisma.$queryRaw<
        {
          requests: bigint;
          cost: bigint;
          errors: bigint;
          grounded: number | null;
          p95: number | null;
        }[]
      >`
        SELECT count(*) AS requests, coalesce(sum(cost_micros), 0) AS cost,
               count(*) FILTER (WHERE error IS NOT NULL) AS errors,
               (avg(CASE WHEN grounded THEN 1.0 ELSE 0.0 END) FILTER (WHERE grounded IS NOT NULL) * 100)::float AS grounded,
               percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)::float AS p95
        FROM ai_requests WHERE created_at >= ${since}`,
      this.prisma.aiRequest.findMany({
        where: { createdAt: { gte: since }, error: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { createdAt: true, feature: true, model: true, error: true },
      }),
      this.usage.spentTodayMicros(),
    ]);

    const budgetCents = this.config.get('AI_DAILY_BUDGET_CENTS', { infer: true });
    const total = totals[0];
    return {
      days,
      config: {
        assistantDriver: this.config.get('AI_DRIVER', { infer: true }),
        assistantModel:
          this.config.get('AI_DRIVER', { infer: true }) === 'anthropic'
            ? this.config.get('AI_MODEL', { infer: true })
            : 'local',
        embeddingsDriver: this.embeddings.driver,
        embeddingsModel: this.embeddings.model,
        dailyBudgetUsd: budgetCents / 100,
      },
      today: {
        spentUsd: usd(spentToday),
        budgetUsedPercent: budgetCents
          ? Math.min(100, Math.round(spentToday / (budgetCents * 100)))
          : 0,
      },
      totals: {
        requests: Number(total?.requests ?? 0),
        costUsd: usd(total?.cost ?? 0),
        errors: Number(total?.errors ?? 0),
        groundedPercent:
          total?.grounded === null || total?.grounded === undefined
            ? null
            : Math.round(total.grounded * 10) / 10,
        p95LatencyMs: int(total?.p95 ?? null),
      },
      daily: daily.map((row) => ({
        day: row.day,
        requests: Number(row.requests),
        costUsd: usd(row.cost),
        errors: Number(row.errors),
        avgLatencyMs: int(row.latency),
      })),
      byFeature: byFeature.map((row) => ({
        feature: row.feature,
        driver: row.driver,
        model: row.model,
        requests: Number(row.requests),
        inputTokens: Number(row.input),
        outputTokens: Number(row.output),
        costUsd: usd(row.cost),
        avgLatencyMs: int(row.latency),
      })),
      recentErrors: errors.map((row) => ({
        at: row.createdAt.toISOString(),
        feature: row.feature,
        model: row.model,
        error: row.error ?? '',
      })),
    };
  }
}
