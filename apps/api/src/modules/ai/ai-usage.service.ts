import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

/** US dollars per million tokens: [input, output]. Unknown models are priced like Sonnet. */
const PRICES: Record<string, [number, number]> = {
  'claude-haiku-4-5': [1, 5],
  'claude-sonnet-5-5': [2, 10],
  'voyage-4-lite': [0.02, 0],
  'voyage-4': [0.06, 0],
  'voyage-4-large': [0.12, 0],
};
const FALLBACK_PRICE: [number, number] = [2, 10];

export function priceOf(model: string): [number, number] {
  if (model.startsWith('local')) return [0, 0];
  const exact = PRICES[model];
  if (exact) return exact;
  // Dated snapshots ("claude-haiku-4-5-20251001") share their alias's price.
  const alias = Object.keys(PRICES).find((name) => model.startsWith(`${name}-`));
  return alias ? PRICES[alias]! : FALLBACK_PRICE;
}

/** Estimated cost in millionths of a dollar (a $1/MTok input token costs 1 micro). */
export function costMicros(model: string, inputTokens: number, outputTokens: number): number {
  const [input, output] = priceOf(model);
  return Math.round(inputTokens * input + outputTokens * output);
}

export type AiCall = {
  feature: string;
  driver: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  grounded?: boolean;
  error?: string;
};

/** Logs every model call and enforces the daily budget for paid drivers. */
@Injectable()
export class AiUsageService {
  private readonly logger = new Logger(AiUsageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  async record(call: AiCall): Promise<void> {
    const inputTokens = call.inputTokens ?? 0;
    const outputTokens = call.outputTokens ?? 0;
    try {
      await this.prisma.aiRequest.create({
        data: {
          feature: call.feature,
          driver: call.driver,
          model: call.model,
          inputTokens,
          outputTokens,
          costMicros: costMicros(call.model, inputTokens, outputTokens),
          latencyMs: Math.max(0, Math.round(call.latencyMs)),
          grounded: call.grounded ?? null,
          error: call.error?.slice(0, 500) ?? null,
        },
      });
    } catch (error) {
      // Usage logging must never break a shopper's request.
      this.logger.warn(`Could not record AI usage: ${(error as Error).message}`);
    }
  }

  /** Spend so far in the current UTC day, in millionths of a dollar. */
  async spentTodayMicros(): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const sum = await this.prisma.aiRequest.aggregate({
      where: { createdAt: { gte: start } },
      _sum: { costMicros: true },
    });
    return sum._sum.costMicros ?? 0;
  }

  /** False once today's paid spend reaches AI_DAILY_BUDGET_CENTS. */
  async withinBudget(): Promise<boolean> {
    const budgetMicros = this.config.get('AI_DAILY_BUDGET_CENTS', { infer: true }) * 10_000;
    return (await this.spentTodayMicros()) < budgetMicros;
  }
}
