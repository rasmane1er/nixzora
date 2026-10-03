import { Inject, Injectable, Logger } from '@nestjs/common';
import { INTL_LOCALE, type MessageKey } from '@nixzora/i18n';
import {
  type AssistantChatRequest,
  type AssistantChatResponse,
  type AssistantPick,
  type Comparison,
} from '@nixzora/validation';
import { PrismaService } from '../../prisma/prisma.service';
import { AiUsageService } from '../ai/ai-usage.service';
import { conceptsIn } from '../ai/concepts';
import { CatalogQueryService } from '../catalog/catalog-query.service';
import { availableOf } from '../catalog/catalog-mappers';
import { SearchIndexService } from '../search/search-index.service';
import { humanKey } from '../search/search-documents';
import {
  LANGUAGE_MODEL,
  type LanguageModel,
  LocalLanguageModel,
  type ExplainInput,
  type PickFacts,
  type Usage,
  groundExplanation,
  templateExplanation,
} from './language-model';
import { type CategoryRef, type ParsedNeed, QUALITIES, qualityLabel } from './need';
import { type Locale, type Replies, repliesFor } from './replies';

const MAX_PICKS = 3;

type Candidate = {
  id: string;
  title: string;
  description: string;
  attributes: Record<string, unknown>;
  categoryId: string;
  brand: string | null;
  priceFromCents: number;
  inStock: boolean;
  defaultVariantId: string | null;
  text: string;
  relevance: number;
};

/** Spec-based evidence that a product has a quality, as a short phrase, or null. */
export function evidence(
  quality: string,
  c: Pick<Candidate, 'attributes' | 'text'>,
  locale: Locale = 'en',
): string | null {
  const { t, num: n } = repliesFor(locale);
  const a = c.attributes;
  const num = (key: string) => (typeof a[key] === 'number' ? (a[key] as number) : undefined);
  const concepts = new Set(conceptsIn(c.text));
  switch (quality) {
    case 'lightweight': {
      const kg = num('weight_kg');
      if (kg !== undefined) return kg <= 1.5 ? t('weightKg', { value: n(kg) }) : null;
      const g = num('weight_g');
      if (g !== undefined) return g <= 260 ? t('weightG', { value: n(g) }) : null;
      return concepts.has('lightweight') ? t('lightweight') : null;
    }
    case 'battery': {
      const hours = num('battery_hours');
      if (hours !== undefined) return hours >= 14 ? t('batteryHours', { value: n(hours) }) : null;
      const days = num('battery_days');
      if (days !== undefined) return days >= 5 ? t('batteryDays', { value: n(days) }) : null;
      const mah = num('battery_mah');
      return mah !== undefined && mah >= 4500 ? t('batteryMah', { value: n(mah) }) : null;
    }
    case 'noise_cancelling':
      return a.anc === true ? t('ancActive') : null;
    case 'comfort':
      return /cushion|memory-foam|comfortable|soft/i.test(c.text) ? t('comfortableCushions') : null;
    case 'quiet':
      if (/fanless/i.test(c.text)) return t('fanless');
      if (/silent/i.test(c.text)) return t('silent');
      if (a.anc === true) return t('ancActive');
      return /\bquiet\b/i.test(c.text) ? t('quiet') : null;
    case 'wireless':
      return a.wireless === true || /wireless|bluetooth/i.test(c.text) ? t('wireless') : null;
    case 'large_screen': {
      const size = num('size_in') ?? num('screen_in');
      return size !== undefined && size >= 16 ? t('screenInches', { value: n(size) }) : null;
    }
    case 'high_refresh': {
      const hz = num('refresh_hz');
      return hz !== undefined && hz >= 120 ? t('refreshDisplay', { value: n(hz) }) : null;
    }
    case 'developer': {
      const cores = num('cpu_cores');
      if (cores !== undefined && cores >= 10) return t('cpuCores', { value: n(cores) });
      return concepts.has('developer') ? t('builtForCoding') : null;
    }
    case 'travel': {
      const kg = num('weight_kg');
      if (kg !== undefined && kg <= 1.5) return t('weightKg', { value: n(kg) });
      if (a.anc === true) return t('ancForFlights');
      return concepts.has('travel') ? t('travelFriendly') : null;
    }
    case 'fitness':
      return a.gps === true
        ? t('gpsTracking')
        : concepts.has('fitness')
          ? t('fitnessTracking')
          : null;
    default:
      // design, gaming, ergonomic: described in the product's own words.
      return concepts.has(quality) ? qualityLabel(quality, locale) : null;
  }
}

/** A few key specs as short phrases, for highlights and the comparison table. */
function keySpecs(attributes: Record<string, unknown>, { t, num: n }: Replies): string[] {
  const phrases: string[] = [];
  const a = attributes;
  if (typeof a.cpu_cores === 'number') phrases.push(t('cpuCores', { value: n(a.cpu_cores) }));
  if (typeof a.battery_hours === 'number')
    phrases.push(t('batteryHours', { value: n(a.battery_hours) }));
  if (typeof a.weight_kg === 'number') phrases.push(t('weightKg', { value: n(a.weight_kg) }));
  if (typeof a.weight_g === 'number') phrases.push(t('weightG', { value: n(a.weight_g) }));
  if (typeof a.screen_in === 'number') phrases.push(t('inches', { value: n(a.screen_in) }));
  if (typeof a.size_in === 'number') phrases.push(t('inches', { value: n(a.size_in) }));
  if (typeof a.resolution === 'string') phrases.push(a.resolution);
  if (typeof a.refresh_hz === 'number' && a.refresh_hz >= 100)
    phrases.push(t('refresh', { value: n(a.refresh_hz) }));
  if (a.anc === true) phrases.push(t('anc'));
  return phrases;
}

type Value = number | string | boolean;
const yesNo = (v: Value, { t }: Replies) => (v === true ? t('yes') : t('no'));

/** Comparison rows: spec keys that share a row, with a readable label and units. */
const COMPARE_ROWS: {
  label: MessageKey<'assistantReplies'>;
  keys: string[];
  format: (value: Value, replies: Replies) => string;
}[] = [
  {
    label: 'rowCpu',
    keys: ['cpu_cores'],
    format: (v, r) => r.t('cores', { value: r.num(v as number) }),
  },
  {
    label: 'rowScreen',
    keys: ['screen_in', 'size_in'],
    format: (v, r) => `${r.num(v as number)}″`,
  },
  { label: 'rowResolution', keys: ['resolution'], format: String },
  { label: 'rowRefreshRate', keys: ['refresh_hz'], format: (v, r) => `${r.num(v as number)} Hz` },
  { label: 'rowWeight', keys: ['weight_kg', 'weight_g'], format: (v, r) => r.num(v as number) },
  {
    label: 'rowBattery',
    keys: ['battery_hours', 'battery_days', 'battery_mah'],
    format: (v, r) => r.num(v as number),
  },
  { label: 'rowNoiseCancelling', keys: ['anc'], format: yesNo },
  { label: 'rowWireless', keys: ['wireless'], format: yesNo },
  { label: 'rowPanel', keys: ['panel'], format: String },
];

const UNITS: Record<string, string> = {
  weight_kg: ' kg',
  weight_g: ' g',
  battery_hours: ' h',
  battery_mah: ' mAh',
};

function compareValue(
  attributes: Record<string, unknown>,
  keys: string[],
  format: (v: Value, replies: Replies) => string,
  replies: Replies,
) {
  for (const key of keys) {
    const value = attributes[key];
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
      const shown = format(value, replies);
      return key === 'battery_days'
        ? replies.t('days', { value: shown })
        : `${shown}${UNITS[key] ?? ''}`;
    }
  }
  return null;
}

function formatValue(value: unknown, { t }: Replies): string | null {
  if (value === true) return t('yes');
  if (value === false) return t('no');
  if (typeof value === 'number' || (typeof value === 'string' && value.trim()))
    return String(value);
  return null;
}

/** Relaxed requirements (internal names) → how the shopper reads them. */
const RELAXED: Record<string, MessageKey<'assistantReplies'>> = {
  'in stock': 'relaxedInStock',
  'your budget': 'relaxedBudget',
  'the category': 'relaxedCategory',
};

/**
 * The shopping assistant (p6-05, ADR-0009): understand → retrieve → filter → rank → explain.
 * Every product, price and stock state comes from the database; the model only writes the
 * short explanation, and that text is checked against the facts before it is shown.
 */
@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);
  private readonly local = new LocalLanguageModel();

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchIndexService,
    private readonly catalog: CatalogQueryService,
    private readonly usage: AiUsageService,
    @Inject(LANGUAGE_MODEL) private readonly llm: LanguageModel,
  ) {}

  async chat(request: AssistantChatRequest, locale: Locale = 'en'): Promise<AssistantChatResponse> {
    const r = repliesFor(locale);
    const userTurns = request.messages.filter((m) => m.role === 'user').map((m) => m.content);
    const lastTurn = userTurns[userTurns.length - 1]!;
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, slug: true, name: true, parentId: true },
    });
    const model = await this.chooseModel();

    const started = Date.now();
    // English calls keep their exact shape (older AI services, recorded test doubles).
    const language = locale === 'en' ? [] : [locale];
    const understood = await this.withFallback(model, (m) =>
      m.understand(userTurns, categories, ...language),
    );
    const need = understood.value.need;

    const { picks, relaxed } = await this.findPicks(need, categories);
    const cards = await this.catalog.cardsByIds(picks.map((p) => p.id));
    const cardById = new Map(cards.map((card) => [card.id, card]));
    const shown = picks.filter((p) => cardById.has(p.id));

    const facts: PickFacts[] = shown.map((p, i) => ({
      n: i + 1,
      title: p.title,
      brand: p.brand,
      price: r.money(p.priceFromCents),
      badge: this.badgeFor(p, i, shown, need, r),
      matched: need.qualities.flatMap((q) => (evidence(q, p) ? [qualityLabel(q, locale)] : [])),
      highlights: this.highlights(p, need, r),
    }));
    const category = categories.find((c) => c.slug === need.category) ?? null;
    const needSummary = this.summarize(need, category, lastTurn, r);
    const relaxedLabels = relaxed.map((label) => r.t(RELAXED[label]!));
    const explainInput: ExplainInput = {
      request: lastTurn,
      needSummary,
      picks: facts,
      relaxed: relaxedLabels,
      ...(locale === 'en' ? {} : { locale }),
    };

    const explained = await this.withFallback(understood.model, (m) => m.explain(explainInput));
    let reply = explained.value.text;
    let grounded = true;
    if (explained.model.driver !== 'local') {
      const checked = groundExplanation(reply, facts, locale);
      if (checked === null) {
        grounded = false;
        reply = templateExplanation(explainInput);
      } else reply = checked;
    }

    await this.usage.record({
      feature: 'assistant',
      driver: explained.model.driver,
      model: explained.model.model,
      inputTokens: understood.value.usage.inputTokens + explained.value.usage.inputTokens,
      outputTokens: understood.value.usage.outputTokens + explained.value.usage.outputTokens,
      latencyMs: Date.now() - started,
      grounded,
    });

    const resultPicks: AssistantPick[] = shown.map((p, i) => ({
      product: cardById.get(p.id)!,
      badge: facts[i]!.badge,
      reason: facts[i]!.highlights.length
        ? `${facts[i]!.highlights.slice(0, 3).join(' · ')}`
        : `${p.brand ? `${p.brand} · ` : ''}${r.money(p.priceFromCents)}`,
      matched: facts[i]!.matched,
      variantId: p.defaultVariantId,
    }));

    return {
      reply,
      need: {
        category: category?.slug ?? null,
        categoryName: category ? r.department(category) : null,
        minPriceCents: need.minPriceCents,
        maxPriceCents: need.maxPriceCents,
        mustHave: need.qualities.map((q) => qualityLabel(q, locale)),
        query: need.query,
      },
      picks: resultPicks,
      comparison: shown.length >= 2 ? await this.compare(shown, r) : null,
      suggestions: shown.length
        ? this.suggestions(need, shown, r)
        : categories
            .filter((c) => c.parentId)
            .slice(0, 3)
            .map((c) =>
              r.t('suggestCategory', {
                category: locale === 'en' ? c.name.toLowerCase() : r.department(c),
              }),
            ),
      relaxed: relaxedLabels,
      model: explained.model.model,
    };
  }

  /** The paid model while today's budget lasts; the local driver after that. */
  private async chooseModel(): Promise<LanguageModel> {
    if (this.llm.driver === 'local') return this.llm;
    return (await this.usage.withinBudget()) ? this.llm : this.local;
  }

  /** Runs a model step; on a provider error, logs it and answers with the local driver. */
  private async withFallback<T>(
    model: LanguageModel,
    step: (m: LanguageModel) => Promise<T & { usage: Usage }>,
  ): Promise<{ value: T & { usage: Usage }; model: LanguageModel }> {
    if (model.driver === 'local') return { value: await step(model), model };
    const started = Date.now();
    try {
      return { value: await step(model), model };
    } catch (error) {
      const message = (error as Error).message;
      this.logger.warn(`Assistant model failed, using the local driver: ${message}`);
      await this.usage.record({
        feature: 'assistant',
        driver: model.driver,
        model: model.model,
        latencyMs: Date.now() - started,
        error: message,
      });
      return { value: await step(this.local), model: this.local };
    }
  }

  private async findPicks(
    need: ParsedNeed,
    categories: (CategoryRef & { id: string; parentId: string | null })[],
  ): Promise<{ picks: Candidate[]; candidates: Candidate[]; relaxed: string[] }> {
    const searchText = [need.query, ...need.qualities.map((q) => QUALITIES[q])].join(' ');
    const ranked = (await this.search.isReady())
      ? await this.search.hybrid(searchText, {
          status: 'ACTIVE',
          limit: 60,
          minSimilarity: 0.2,
          allowLoose: false,
        })
      : new Map<string, number>();

    const categoryIds = need.category ? this.descendants(need.category, categories) : null;
    const rows = await this.prisma.product.findMany({
      where: {
        status: 'ACTIVE',
        OR: [
          { id: { in: [...ranked.keys()] } },
          ...(categoryIds ? [{ categoryId: { in: categoryIds } }] : []),
        ],
      },
      include: {
        brand: { select: { name: true } },
        category: { select: { name: true } },
        variants: { where: { isActive: true }, include: { inventory: true } },
      },
      take: 200,
    });

    const top = Math.max(0, ...ranked.values());
    const candidates: Candidate[] = rows
      .filter((row) => row.variants.length > 0)
      .map((row) => {
        const variants = [...row.variants].sort((a, b) => a.priceCents - b.priceCents);
        const inStock = variants.filter((v) => availableOf(v.inventory) > 0);
        return {
          id: row.id,
          title: row.title,
          description: row.description,
          attributes: (row.attributes ?? {}) as Record<string, unknown>,
          categoryId: row.categoryId,
          brand: row.brand?.name ?? null,
          priceFromCents: variants[0]!.priceCents,
          inStock: inStock.length > 0,
          defaultVariantId: (inStock[0] ?? variants[0])?.id ?? null,
          text: `${row.title} ${row.category.name} ${row.description}`,
          relevance: top > 0 ? (ranked.get(row.id) ?? 0) / top : 0,
        };
      });

    // Hard filters first; if nothing passes, relax them one at a time and say so.
    const inCategory = (c: Candidate) => !categoryIds || categoryIds.includes(c.categoryId);
    const inBudget = (c: Candidate) =>
      (need.maxPriceCents === null || c.priceFromCents <= need.maxPriceCents) &&
      (need.minPriceCents === null || c.priceFromCents >= need.minPriceCents);
    const relevant = (c: Candidate) => c.relevance > 0 || Boolean(categoryIds);
    const stages: { label: string | null; test: (c: Candidate) => boolean }[] = [
      { label: null, test: (c) => relevant(c) && inCategory(c) && inBudget(c) && c.inStock },
      { label: 'in stock', test: (c) => relevant(c) && inCategory(c) && inBudget(c) },
      { label: 'your budget', test: (c) => relevant(c) && inCategory(c) },
      { label: 'the category', test: (c) => relevant(c) },
    ];
    let pool: Candidate[] = [];
    for (const stage of stages) {
      pool = candidates.filter(stage.test);
      if (pool.length) break;
    }

    const score = (c: Candidate) => {
      const matched = need.qualities.filter((q) => evidence(q, c)).length;
      const qualityScore = need.qualities.length ? matched / need.qualities.length : 0;
      return (
        (need.qualities.length ? 0.45 : 0.8) * c.relevance +
        0.45 * qualityScore +
        0.1 * Number(c.inStock)
      );
    };
    const picks = [...pool]
      .sort((a, b) => score(b) - score(a) || a.priceFromCents - b.priceFromCents)
      .slice(0, MAX_PICKS);
    // Report only the requirements the shown picks actually miss.
    const relaxed = stages
      .filter((stage) => stage.label)
      .flatMap((stage) => {
        const misses =
          stage.label === 'in stock'
            ? picks.some((c) => !c.inStock)
            : stage.label === 'your budget'
              ? picks.some((c) => !inBudget(c))
              : picks.some((c) => !inCategory(c));
        return misses ? [stage.label!] : [];
      });
    return { picks, candidates: pool, relaxed };
  }

  private descendants(
    slug: string,
    categories: { id: string; slug: string; parentId: string | null }[],
  ) {
    const root = categories.find((c) => c.slug === slug);
    if (!root) return null;
    const ids = [root.id];
    for (let i = 0; i < ids.length; i++)
      for (const c of categories) if (c.parentId === ids[i]) ids.push(c.id);
    return ids;
  }

  private badgeFor(
    pick: Candidate,
    index: number,
    picks: Candidate[],
    need: ParsedNeed,
    { t }: Replies,
  ): string | null {
    if (index === 0) return t('badgeBestMatch');
    const cheapest = picks.reduce((a, b) => (b.priceFromCents < a.priceFromCents ? b : a));
    if (cheapest.id === pick.id && pick.priceFromCents < picks[0]!.priceFromCents)
      return t('badgeBestValue');
    const best = (key: string, higher: boolean) => {
      const values = picks.map((p) =>
        typeof p.attributes[key] === 'number' ? (p.attributes[key] as number) : null,
      );
      const known = values.filter((v): v is number => v !== null);
      if (known.length < 2) return false;
      const target = higher ? Math.max(...known) : Math.min(...known);
      return values[index] === target && values.filter((v) => v === target).length === 1;
    };
    if (best('battery_hours', true) || best('battery_days', true)) return t('badgeLongestBattery');
    if (best('weight_kg', false) || best('weight_g', false)) return t('badgeLightest');
    if (need.qualities.includes('developer') && best('cpu_cores', true))
      return t('badgeMostPowerful');
    return null;
  }

  private highlights(pick: Candidate, need: ParsedNeed, r: Replies): string[] {
    const out: string[] = [];
    for (const q of need.qualities) {
      const fact = evidence(q, pick, r.locale);
      if (fact && !out.includes(fact)) out.push(fact);
    }
    for (const spec of keySpecs(pick.attributes, r))
      if (!out.some((fact) => fact.includes(spec) || spec.includes(fact))) out.push(spec);
    if (!pick.inStock) out.push(r.t('outOfStockNote'));
    return out.slice(0, 4);
  }

  /** "laptops under $1,500 (quiet, good for coding)", in the shopper's language. */
  private summarize(
    need: ParsedNeed,
    category: CategoryRef | null,
    lastTurn: string,
    { t, money, locale, department }: Replies,
  ): string {
    const what = category ? department(category).toLowerCase() : '';
    const budget =
      need.minPriceCents !== null && need.maxPriceCents !== null
        ? t('budgetBetween', { min: money(need.minPriceCents), max: money(need.maxPriceCents) })
        : need.maxPriceCents !== null
          ? t('budgetUnder', { max: money(need.maxPriceCents) })
          : need.minPriceCents !== null
            ? t('budgetOver', { min: money(need.minPriceCents) })
            : '';
    const labels = need.qualities.map((q) => qualityLabel(q, locale));
    const qualities = labels.length ? t('needQualities', { qualities: labels.join(', ') }) : '';
    if (category) return `${what}${budget}${qualities}`;
    // The search query is in English (the catalog's language); other languages quote the
    // shopper's own words, which already carry their budget.
    return locale === 'en'
      ? `${t('needQuery', { query: need.query })}${budget}`
      : t('needQuery', { query: lastTurn.trim() });
  }

  private async compare(picks: Candidate[], r: Replies): Promise<Comparison> {
    const rating = (average: number) =>
      r.locale === 'en'
        ? average.toFixed(1)
        : average.toLocaleString(INTL_LOCALE[r.locale], {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          });
    const ratings = await this.prisma.review.groupBy({
      by: ['productId'],
      where: { productId: { in: picks.map((p) => p.id) }, status: 'APPROVED' },
      _avg: { rating: true },
      _count: { _all: true },
    });
    const ratingOf = new Map(ratings.map((r) => [r.productId, r]));
    const rows: Comparison['rows'] = [
      {
        label: r.t('rowPrice'),
        values: picks.map((p) => r.t('priceFrom', { price: r.money(p.priceFromCents) })),
      },
      {
        label: r.t('rowRating'),
        values: picks.map((p) => {
          const stats = ratingOf.get(p.id);
          return stats?._avg.rating
            ? `${rating(stats._avg.rating)} ★ (${r.num(stats._count._all)})`
            : null;
        }),
      },
    ];
    const known = new Set(COMPARE_ROWS.flatMap((row) => row.keys));
    for (const row of COMPARE_ROWS) {
      const values = picks.map((p) => compareValue(p.attributes, row.keys, row.format, r));
      if (values.filter(Boolean).length >= 2) rows.push({ label: r.t(row.label), values });
    }
    // Other specs the picks share, with a generic label.
    const extra = new Map<string, number>();
    for (const p of picks)
      for (const key of Object.keys(p.attributes))
        if (!known.has(key)) extra.set(key, (extra.get(key) ?? 0) + 1);
    for (const [key, count] of extra) {
      if (count < 2 || rows.length >= 9) continue;
      rows.push({
        label: humanKey(key).replace(/^./, (c) => c.toUpperCase()),
        values: picks.map((p) => formatValue(p.attributes[key], r)),
      });
    }
    rows.push({
      label: r.t('rowAvailability'),
      values: picks.map((p) => (p.inStock ? r.t('inStock') : r.t('outOfStock'))),
    });
    return { rows: rows.filter((row) => row.values.some((v) => v !== null)) };
  }

  private suggestions(need: ParsedNeed, picks: Candidate[], { t, money }: Replies): string[] {
    const out: string[] = [];
    if (picks[0]) out.push(t('suggestCheaper', { price: money(picks[0].priceFromCents) }));
    const followUps: [string, MessageKey<'assistantReplies'>][] = [
      ['battery', 'suggestBattery'],
      ['lightweight', 'suggestLighter'],
      ['quiet', 'suggestQuieter'],
      ['noise_cancelling', 'suggestNoiseCancelling'],
      ['large_screen', 'suggestBiggerScreen'],
    ];
    for (const [quality, prompt] of followUps) {
      if (out.length >= 3) break;
      if (!need.qualities.includes(quality) && picks.some((p) => evidence(quality, p)))
        out.push(t(prompt));
    }
    return out.slice(0, 4);
  }
}
