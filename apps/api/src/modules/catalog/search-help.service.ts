import { Injectable } from '@nestjs/common';
import { type Locale, messagesFor } from '@nixzora/i18n';
import { type SearchSuggestions } from '@nixzora/validation';
import { ReadDatabase } from '../../prisma/read-database';
import { CatalogQueryService } from './catalog-query.service';
import { Spelling } from './spelling';

/** A search is suggested to others only once this many different shoppers ran it. */
const MIN_SEARCHERS = 3;

/**
 * Search suggestions while typing (p10-03): popular searches, catalog words, departments,
 * brands and the top products, plus "did you mean". Popular searches come from the searches
 * shoppers ran (p10-02), only once several different shoppers ran them, so one person's search
 * is never shown to anyone else.
 */
@Injectable()
export class SearchHelpService {
  constructor(
    private readonly read: ReadDatabase,
    private readonly catalog: CatalogQueryService,
    private readonly spelling: Spelling,
  ) {}

  async suggest(raw: string, locale: Locale): Promise<SearchSuggestions> {
    const text = raw.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 100);
    const empty = { completions: [], categories: [], brands: [], products: [], correction: null };
    if (!text) return empty;

    const [popular, words] = await Promise.all([
      this.popularSearches(text, 5),
      this.wordCompletions(text, 5),
    ]);
    // Products for what the shopper is most likely typing: "head" shows headphones.
    const likely = popular[0] ?? words[0] ?? text;
    const [categories, brands, products, correction] = await Promise.all([
      this.matchingDepartments(text, locale),
      this.read.client.brand.findMany({
        where: {
          OR: [
            { name: { startsWith: text, mode: 'insensitive' } },
            { name: { contains: ` ${text}`, mode: 'insensitive' } },
          ],
        },
        orderBy: { name: 'asc' },
        take: 3,
        select: { slug: true, name: true },
      }),
      text.length >= 2 ? this.topProducts(likely, 4) : Promise.resolve([]),
      text.length >= 4 ? this.spelling.correct(text) : Promise.resolve(null),
    ]);
    const completions = [...new Set([...popular, ...words])]
      .filter((completion) => completion !== text)
      .slice(0, 6);
    return { completions, categories, brands, products, correction };
  }

  private async popularSearches(prefix: string, limit: number): Promise<string[]> {
    const rows = await this.read.client.$queryRaw<{ text: string }[]>`
      SELECT text FROM shopper_interests
      WHERE source = 'SEARCH'
        AND updated_at > now() - interval '90 days'
        AND text LIKE ${`${prefix.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}
      GROUP BY text
      HAVING COUNT(DISTINCT COALESCE(user_id::text, visitor_id)) >= ${MIN_SEARCHERS}
      ORDER BY COUNT(DISTINCT COALESCE(user_id::text, visitor_id)) DESC, text
      LIMIT ${limit}`;
    return rows.map((row) => row.text);
  }

  /** "wireless head" → "wireless headphones", "wireless headset": the last word finished. */
  private async wordCompletions(text: string, limit: number): Promise<string[]> {
    const parts = text.split(' ');
    const last = parts.pop() ?? '';
    const lead = parts.length ? `${parts.join(' ')} ` : '';
    return (await this.spelling.complete(last, limit)).map((word) => `${lead}${word}`);
  }

  private async matchingDepartments(text: string, locale: Locale) {
    const names = messagesFor(locale).departments as Record<string, string>;
    const categories = await this.read.client.category.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
    });
    const starts = (name: string) =>
      name
        .toLowerCase()
        .split(/[\s&,]+/)
        .some((word) => word.startsWith(text)) || name.toLowerCase().startsWith(text);
    return categories
      .map((c) => ({ slug: c.slug, name: names[c.slug] ?? c.name, english: c.name }))
      .filter((c) => starts(c.name) || starts(c.english))
      .slice(0, 3)
      .map(({ slug, name }) => ({ slug, name }));
  }

  private async topProducts(text: string, limit: number) {
    const rank = await this.catalog.searchRank(text, 'ACTIVE');
    const ids = [...rank.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([id]) => id);
    return this.catalog.cardsByIds(ids);
  }
}
