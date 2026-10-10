import { Injectable } from '@nestjs/common';
import { LOCALES, messagesFor } from '@nixzora/i18n';
import { SPECS } from '@nixzora/validation';
import { ReadDatabase } from '../../prisma/read-database';

/** The vocabulary is rebuilt at most this often (new products bring new words). */
const VOCABULARY_TTL_MS = 10 * 60 * 1000;

/** "Headphones," → ["headphones"]: lower-case words of letters (any alphabet), 3+ long. */
export function words(text: string): string[] {
  return text.toLowerCase().match(/\p{L}{3,}/gu) ?? [];
}

/** Edits between two words, counting a swap of neighbours as one (Damerau, restricted). */
export function editDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const d: number[][] = Array.from({ length: rows }, (_, i) =>
    Array.from({ length: cols }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i < rows; i++) {
    let best = Infinity;
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        value = Math.min(value, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = value;
      best = Math.min(best, value);
    }
    if (best > max) return max + 1;
  }
  return d[a.length]![b.length]!;
}

/**
 * "Did you mean" (p10-03): fixes misspelled words against the words the catalog actually uses
 * (product titles, brands, categories in every language, spec words). No dictionary service
 * and no model: a word is only replaced by a close catalog word, so corrections always find
 * something.
 */
@Injectable()
export class Spelling {
  private cache?: { words: Map<string, number>; until: number };

  constructor(private readonly read: ReadDatabase) {}

  /** Catalog words and how often they appear, most common first. */
  async vocabulary(): Promise<Map<string, number>> {
    if (this.cache && this.cache.until > Date.now()) return this.cache.words;
    const [products, brands, categories] = await Promise.all([
      this.read.client.product.findMany({ where: { status: 'ACTIVE' }, select: { title: true } }),
      this.read.client.brand.findMany({ select: { name: true } }),
      this.read.client.category.findMany({ select: { name: true } }),
    ]);
    const counts = new Map<string, number>();
    const add = (text: string, weight = 1) => {
      for (const word of words(text)) counts.set(word, (counts.get(word) ?? 0) + weight);
    };
    products.forEach((p) => add(p.title));
    brands.forEach((b) => add(b.name, 2));
    categories.forEach((c) => add(c.name, 3));
    for (const locale of LOCALES) {
      Object.values(messagesFor(locale).departments).forEach((name) => add(name, 3));
    }
    Object.values(SPECS).forEach((text) => add(text));
    const sorted = new Map([...counts].sort((a, b) => b[1] - a[1]));
    this.cache = { words: sorted, until: Date.now() + VOCABULARY_TTL_MS };
    return sorted;
  }

  /** The query with misspelled words replaced, or null when every word is fine. */
  async correct(query: string): Promise<string | null> {
    const vocabulary = await this.vocabulary();
    const prefixes = [...vocabulary.keys()];
    const known = (word: string) =>
      vocabulary.has(word) ||
      // Still typing: "head" is on its way to "headphones".
      prefixes.some((entry) => entry.startsWith(word)) ||
      vocabulary.has(`${word}s`) ||
      (word.endsWith('s') && vocabulary.has(word.slice(0, -1)));
    let changed = false;
    const fixed = query
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        if (!/^\p{L}{4,}$/u.test(token) || known(token)) return token;
        const max = token.length >= 7 ? 2 : 1;
        let best: { word: string; distance: number } | null = null;
        for (const word of vocabulary.keys()) {
          const distance = editDistance(token, word, max);
          // The vocabulary is most common first, so ties keep the more common word.
          if (distance <= max && (!best || distance < best.distance)) best = { word, distance };
          if (best?.distance === 1 && max === 1) break;
        }
        if (!best) return token;
        changed = true;
        return best.word;
      });
    return changed ? fixed.join(' ') : null;
  }

  /** Catalog words starting with `prefix`, most common first. */
  async complete(prefix: string, limit: number): Promise<string[]> {
    if (prefix.length < 2) return [];
    const vocabulary = await this.vocabulary();
    const out: string[] = [];
    for (const word of vocabulary.keys()) {
      if (word.startsWith(prefix) && word !== prefix) out.push(word);
      if (out.length >= limit) break;
    }
    return out;
  }
}
