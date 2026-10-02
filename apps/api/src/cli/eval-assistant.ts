/**
 * Runs the assistant evaluation set (ADR-0009, p6-10) against the seeded demo catalog.
 *
 *   pnpm --filter @nixzora/api eval:assistant              # report, exit 1 below the bar
 *   pnpm --filter @nixzora/api eval:assistant --markdown   # report as a Markdown table
 *
 * Each case is a conversation and expectations about the answer: the category understood,
 * the budget, the top pick, products that must or must not appear, and relaxed requirements.
 * The grounding of every answer is checked too: each pick must exist in the database at the
 * price shown.
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { NestFactory } from '@nestjs/core';
import { type AssistantChatResponse } from '@nixzora/validation';
import { AppModule } from '../app.module';
import { AssistantService } from '../modules/assistant/assistant.service';
import { SearchIndexService } from '../modules/search/search-index.service';
import { PrismaService } from '../prisma/prisma.service';

type Expect = {
  category?: string;
  maxPriceCents?: number;
  top?: string;
  includes?: string[];
  excludes?: string[];
  mustHave?: string[];
  withinBudget?: boolean;
  relaxed?: string[];
  picks?: number;
};
type Case = { id: string; ask: string[]; expect: Expect };

/** The share of cases that must pass for CI to stay green. */
const PASS_BAR = 0.9;

function check(c: Case, r: AssistantChatResponse): string[] {
  const e = c.expect;
  const titles = r.picks.map((p) => p.product.title);
  const failures: string[] = [];
  if (e.category !== undefined && r.need.category !== e.category)
    failures.push(`category ${r.need.category ?? 'none'} ≠ ${e.category}`);
  if (e.maxPriceCents !== undefined && r.need.maxPriceCents !== e.maxPriceCents)
    failures.push(`budget ${r.need.maxPriceCents} ≠ ${e.maxPriceCents}`);
  if (e.top && !titles[0]?.includes(e.top))
    failures.push(`top pick "${titles[0] ?? 'none'}" ≠ ${e.top}`);
  for (const name of e.includes ?? [])
    if (!titles.some((t) => t.includes(name))) failures.push(`missing ${name}`);
  for (const name of e.excludes ?? [])
    if (titles.some((t) => t.includes(name))) failures.push(`unexpected ${name}`);
  for (const quality of e.mustHave ?? [])
    if (!r.need.mustHave.includes(quality)) failures.push(`did not understand "${quality}"`);
  if (e.withinBudget && r.need.maxPriceCents !== null)
    for (const p of r.picks)
      if (p.product.priceFromCents > r.need.maxPriceCents)
        failures.push(`${p.product.title} over budget`);
  if (e.relaxed && JSON.stringify(r.relaxed) !== JSON.stringify(e.relaxed))
    failures.push(`relaxed ${JSON.stringify(r.relaxed)} ≠ ${JSON.stringify(e.relaxed)}`);
  if (e.picks !== undefined && r.picks.length !== e.picks)
    failures.push(`${r.picks.length} picks ≠ ${e.picks}`);
  if (r.picks.length && !r.reply.includes(r.picks[0]!.product.title))
    failures.push('reply does not name the top pick');
  return failures;
}

async function main(): Promise<void> {
  const markdown = process.argv.includes('--markdown');
  const cases = readFileSync(join(process.cwd(), 'eval', 'assistant.jsonl'), 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Case);

  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error'] });
  try {
    await app.get(SearchIndexService).reindexAll();
    const assistant = app.get(AssistantService);
    const prisma = app.get(PrismaService);
    const rows: { id: string; ok: boolean; ms: number; detail: string; model: string }[] = [];
    let ungrounded = 0;

    for (const c of cases) {
      const started = Date.now();
      const r = await assistant.chat({
        messages: c.ask.flatMap((content, i) => [
          ...(i > 0 ? [{ role: 'assistant' as const, content: '…' }] : []),
          { role: 'user' as const, content },
        ]),
      });
      const ms = Date.now() - started;
      // Grounding: every pick is a live product at the price shown.
      for (const pick of r.picks) {
        const variant = await prisma.productVariant.findFirst({
          where: { productId: pick.product.id, isActive: true, product: { status: 'ACTIVE' } },
          orderBy: { priceCents: 'asc' },
        });
        if (variant?.priceCents !== pick.product.priceFromCents) ungrounded++;
      }
      const failures = check(c, r);
      rows.push({
        id: c.id,
        ok: failures.length === 0,
        ms,
        detail: failures.join('; ') || r.picks.map((p) => p.product.title).join(', ') || 'no picks',
        model: r.model,
      });
    }

    const passed = rows.filter((row) => row.ok).length;
    const rate = passed / rows.length;
    const sorted = rows.map((row) => row.ms).sort((a, b) => a - b);
    const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
    const summary = `${passed}/${rows.length} passed (${Math.round(rate * 100)}%), ${ungrounded} ungrounded picks, p95 ${p95} ms, model ${rows[0]?.model ?? '-'}`;

    if (markdown) {
      console.warn(`| Case | Result | Details |\n| --- | --- | --- |`);
      for (const row of rows)
        console.warn(`| ${row.id} | ${row.ok ? 'pass' : '**fail**'} | ${row.detail} |`);
      console.warn(`\n${summary}`);
    } else {
      for (const row of rows)
        console.warn(`${row.ok ? 'PASS' : 'FAIL'}  ${row.id.padEnd(24)} ${row.detail}`);
      console.warn(summary);
    }
    if (rate < PASS_BAR || ungrounded > 0) process.exitCode = 1;
  } finally {
    await app.close();
  }
}

void main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
