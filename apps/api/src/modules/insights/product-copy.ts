import { specPhrases } from '../search/search-documents';

/**
 * Product copy suggestions (p6-03): a short description drafted from the catalog facts, for staff
 * to edit. Never published automatically.
 */
export type ProductFacts = {
  title: string;
  category: string;
  brand: string | null;
  description: string;
  attributes: Record<string, unknown>;
};

function list(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/** A plain description from the specs alone (local driver and model fallback). */
export function templateCopy(facts: ProductFacts): string {
  const specs = specPhrases(facts.attributes).slice(0, 5);
  const noun = facts.category.toLowerCase().replace(/s$/, '');
  const lead = `The ${facts.title} is a ${noun}${facts.brand ? ` from ${facts.brand}` : ''}`;
  return specs.length ? `${lead} with ${list(specs)}.` : `${lead}.`;
}

/** Every number the copy may use: those in the title, current description and specs. */
function allowedNumbers(facts: ProductFacts): Set<string> {
  const text = [facts.title, facts.description, JSON.stringify(facts.attributes)].join(' ');
  const numbers = new Set<string>();
  for (const m of text.matchAll(/\d+(?:\.\d+)?/g)) {
    numbers.add(m[0]);
    numbers.add(String(Number(m[0])));
  }
  return numbers;
}

/**
 * Guardrail for model-written copy: no prices, links or invented numbers, no store superlatives,
 * and a sensible length. Returns the cleaned text, or the reasons it was rejected.
 */
export function checkCopy(
  text: string,
  facts: ProductFacts,
): { text: string } | { problems: string[] } {
  const clean = text.trim().replace(/\s+/g, ' ').replace(/^"|"$/g, '');
  const problems: string[] = [];
  if (clean.length < 40 || clean.length > 700) problems.push('length');
  if (/[$€£]|https?:|www\./i.test(clean)) problems.push('price or link');
  if (/\b(best|#1|number one|cheapest|guaranteed|unbeatable)\b/i.test(clean)) {
    problems.push('superlative');
  }
  const allowed = allowedNumbers(facts);
  const invented = [...clean.matchAll(/\d+(?:\.\d+)?/g)]
    .map((m) => m[0])
    .filter((n) => !allowed.has(n));
  if (invented.length)
    problems.push(`numbers not in the specs: ${[...new Set(invented)].join(', ')}`);
  return problems.length ? { problems } : { text: clean };
}
