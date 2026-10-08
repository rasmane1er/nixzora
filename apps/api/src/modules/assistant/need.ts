import { type MessageKey } from '@nixzora/i18n';
import { conceptOf, conceptsIn, stem, tokenize } from '../ai/concepts';
import { type Locale, repliesFor } from './replies';
import { toEnglishRequest } from './request-language';

/** Qualities a shopper can ask for, keyed by concept, with the label shown back to them. */
export const QUALITIES: Record<string, string> = {
  quiet: 'quiet',
  noise_cancelling: 'noise cancelling',
  travel: 'good for travel',
  lightweight: 'lightweight',
  battery: 'long battery life',
  developer: 'good for coding',
  design: 'good for creative work',
  gaming: 'made for gaming',
  ergonomic: 'ergonomic',
  comfort: 'comfortable',
  wireless: 'wireless',
  large_screen: 'large screen',
  high_refresh: 'high refresh rate',
  fitness: 'fitness tracking',
};

const QUALITY_MESSAGES: Record<string, MessageKey<'assistantReplies'>> = {
  quiet: 'qualityQuiet',
  noise_cancelling: 'qualityNoiseCancelling',
  travel: 'qualityTravel',
  lightweight: 'qualityLightweight',
  battery: 'qualityBattery',
  developer: 'qualityDeveloper',
  design: 'qualityDesign',
  gaming: 'qualityGaming',
  ergonomic: 'qualityErgonomic',
  comfort: 'qualityComfort',
  wireless: 'qualityWireless',
  large_screen: 'qualityLargeScreen',
  high_refresh: 'qualityHighRefresh',
  fitness: 'qualityFitness',
};

/** A quality's label in the shopper's language ("good for travel", "idéal en voyage"). */
export function qualityLabel(quality: string, locale: Locale = 'en'): string {
  if (locale === 'en') return QUALITIES[quality]!;
  const key = QUALITY_MESSAGES[quality];
  return key ? repliesFor(locale).t(key) : QUALITIES[quality]!;
}

export type CategoryRef = { slug: string; name: string };

/** The structured request: produced by the local parser or by Claude, validated either way. */
export type ParsedNeed = {
  category: string | null;
  minPriceCents: number | null;
  maxPriceCents: number | null;
  /** Keys of QUALITIES. */
  qualities: string[];
  /** Text to search the catalog with. */
  query: string;
};

const MONEY = String.raw`\$?\s*(\d[\d,]*(?:\.\d+)?)\s*(k|thousand)?\s*(?:dollars|usd|bucks)?`;

function cents(amount: string, thousands?: string): number {
  const value = Number(amount.replace(/,/g, '')) * (thousands ? 1000 : 1);
  return Math.round(value * 100);
}

/** "under $1,500", "between 200 and 300", "around $250", "$1.5k max". Later turns win. */
export function parseBudget(text: string): { min: number | null; max: number | null } {
  const t = text.toLowerCase();
  let min: number | null = null;
  let max: number | null = null;
  const between = new RegExp(String.raw`between\s+${MONEY}\s+(?:and|-|to)\s+${MONEY}`, 'g');
  for (const m of t.matchAll(between)) {
    min = cents(m[1]!, m[2]);
    max = cents(m[3]!, m[4]);
  }
  const under = new RegExp(
    String.raw`(?:under|below|less than|up to|no more than|max(?:imum)?(?: of)?|cheaper than|within|budget(?: of| is)?|<)\s*${MONEY}`,
    'g',
  );
  for (const m of t.matchAll(under)) {
    // "cheaper than $1,349" excludes $1,349 itself.
    const exclusive = /cheaper than|less than|below/.test(m[0]!);
    max = cents(m[1]!, m[2]) - (exclusive ? 1 : 0);
  }
  const suffixMax = new RegExp(String.raw`${MONEY}\s*(?:max|or less|budget|tops)`, 'g');
  for (const m of t.matchAll(suffixMax)) if (/[$k]|dollar/.test(m[0]!)) max = cents(m[1]!, m[2]);
  const over = new RegExp(String.raw`(?:over|above|more than|at least|>)\s*${MONEY}`, 'g');
  for (const m of t.matchAll(over)) min = cents(m[1]!, m[2]);
  const around = new RegExp(String.raw`(?:around|about|roughly|~)\s*${MONEY}`, 'g');
  for (const m of t.matchAll(around)) {
    const value = cents(m[1]!, m[2]);
    min = Math.round(value * 0.75);
    max = Math.round(value * 1.15);
  }
  if (min !== null && max !== null && min > max) [min, max] = [max, min];
  return { min, max };
}

/** Removes budget phrases ("under $1,500", "between 200 and 300") but keeps specs ("32 GB"). */
export function stripBudget(text: string): string {
  return text
    .replace(new RegExp(String.raw`between\s+${MONEY}\s+(?:and|-|to)\s+${MONEY}`, 'gi'), ' ')
    .replace(
      new RegExp(
        String.raw`(?:under|below|less than|up to|no more than|max(?:imum)?(?: of)?|cheaper than|within|budget(?: of| is)?|over|above|more than|at least|around|about|roughly|[<>~])\s*${MONEY}`,
        'gi',
      ),
      ' ',
    )
    .replace(/\$\s*\d[\d,]*(?:\.\d+)?\s*k?/gi, ' ');
}

/**
 * Words that describe context, not the thing to buy: "control my lamps from my phone",
 * "a mouse for my laptop". The product after "my/your/…" is what the shopper already owns.
 */
const CONTEXT =
  /\b(?:from|on|with|for|to|using|into|in|of)\s+(?:my|our|your|his|her|their)\s+[a-z0-9-]+/gi;

/** The category a request names: "earbuds" → Headphones, "notebook" → Laptops. */
export function matchCategory(text: string, categories: CategoryRef[]): string | null {
  const words = tokenize(text.replace(CONTEXT, ' '));
  // Every supporting word counts: "a controller for PC games" is two votes for Gaming, one for
  // Desktops. An exact name match ("laptop") is worth more than a synonym ("notebook").
  let best: { slug: string; score: number } | null = null;
  for (const category of categories) {
    const nameWords = tokenize(category.name);
    const nameStems = new Set(nameWords.map(stem));
    const nameConcepts = new Set(nameWords.map(conceptOf).filter(Boolean));
    let score = 0;
    for (const word of words) {
      if (nameStems.has(stem(word))) score += 2;
      else {
        const concept = conceptOf(word);
        if (concept && nameConcepts.has(concept)) score += 1;
      }
    }
    // Ties go to product types ("gaming laptop" is a laptop, not the Gaming category).
    if (score > 0 && nameWords.some((w) => PRODUCT_TYPES.has(conceptOf(w) ?? ''))) score += 0.5;
    if (score > 0 && (!best || score > best.score)) best = { slug: category.slug, score };
  }
  return best?.slug ?? null;
}

const PRODUCT_TYPES = new Set([
  'laptop',
  'desktop',
  'monitor',
  'headphones',
  'speakers',
  'keyboard',
  'mouse',
  'phone',
  'watch',
  'shirt',
  'jacket',
  'shoes',
  'skincare',
  'hair',
  'grooming',
]);

/**
 * The offline need parser (ADR-0009): budget from patterns, category from names and synonyms,
 * qualities from the shopping vocabulary. Every shopper turn counts; later turns refine earlier
 * ones ("under $1,500" then "actually under $1,200"). French and Spanish requests are read through
 * their English meaning first (request-language.ts); the search query is then in English, like
 * the catalog.
 */
export function parseNeedLocally(
  shopperTurns: string[],
  categories: CategoryRef[],
  locale: Locale = 'en',
): ParsedNeed {
  const userTurns = shopperTurns.map((turn) => toEnglishRequest(turn, locale));
  let min: number | null = null;
  let max: number | null = null;
  let category: string | null = null;
  const qualities = new Set<string>();
  for (const turn of userTurns) {
    const budget = parseBudget(turn);
    if (budget.min !== null || budget.max !== null) {
      min = budget.min;
      max = budget.max;
    }
    category = matchCategory(turn, categories) ?? category;
    for (const concept of conceptsIn(turn)) if (QUALITIES[concept]) qualities.add(concept);
  }
  // A product type in the request is the category, not a quality ("gaming laptop": both).
  const query = userTurns
    .map(stripBudget)
    .join(' ')
    .replace(/\s+([,.!?])/g, '$1')
    .replace(/([,.!?])(?:\s*[,.!?])+/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return {
    category,
    minPriceCents: min,
    maxPriceCents: max,
    qualities: [...qualities].slice(0, 6),
    query: query || userTurns[userTurns.length - 1] || '',
  };
}
