import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LOCALES, messagesFor } from '@nixzora/i18n';
import { DEPARTMENTS, OPTION_NAMES, SELLER_CATEGORIES, SPECS } from '@nixzora/validation';

/**
 * The catalog taxonomy (@nixzora/validation) is the single source of truth for departments, spec
 * keys and option names; @nixzora/i18n holds their words. These checks keep the two in step.
 */
describe('catalog taxonomy', () => {
  const demoProducts = join(__dirname, '../../../../storefront/public/demo-products');

  it('lists every parent before its children, with unique slugs', () => {
    const seen = new Set<string>();
    for (const department of DEPARTMENTS) {
      expect(seen.has(department.slug)).toBe(false);
      if (department.parent) expect(seen.has(department.parent)).toBe(true);
      seen.add(department.slug);
    }
  });

  it.each(LOCALES)('names every department, spec and option in %s', (locale) => {
    const m = messagesFor(locale);
    const departments = m.departments as Record<string, string>;
    const page = m.productPage as Record<string, string>;
    expect(DEPARTMENTS.filter((d) => !departments[d.slug]).map((d) => d.slug)).toEqual([]);
    expect(Object.keys(SPECS).filter((key) => !page[`spec_${key}`])).toEqual([]);
    expect(OPTION_NAMES.filter((name) => !page[`option_${name}`])).toEqual([]);
  });

  it('has artwork for every department that names some', () => {
    const missing = DEPARTMENTS.filter((d) => 'art' in d)
      .map((d) => (d as { art: string }).art)
      .filter((art) => !existsSync(join(demoProducts, `${art}.webp`)));
    expect(missing).toEqual([]);
  });

  it('keeps the seller categories the existing stores use', () => {
    expect(SELLER_CATEGORIES).toEqual(
      expect.arrayContaining(['audio', 'computers', 'other-electronics']),
    );
  });

  it('only uses known spec keys and option names in the demo catalog', () => {
    const seed = readFileSync(join(__dirname, '../../../prisma/seed.ts'), 'utf8');
    const attributeKeys = [...seed.matchAll(/attributes: \{([^}]*)\}/g)].flatMap((m) =>
      [...m[1]!.matchAll(/(?:^|[,{\s])([a-z][a-z0-9_]*):/g)].map((k) => k[1]!),
    );
    const optionKeys = [...seed.matchAll(/options: \{([^}]*)\}/g)].flatMap((m) =>
      [...m[1]!.matchAll(/(?:^|[,{\s])([a-z][a-z0-9_]*)[,:}\s]/g)].map((k) => k[1]!),
    );
    expect(attributeKeys.length).toBeGreaterThan(50);
    expect([...new Set(attributeKeys)].filter((key) => !(key in SPECS))).toEqual([]);
    expect(
      [...new Set(optionKeys)].filter((n) => !(OPTION_NAMES as readonly string[]).includes(n)),
    ).toEqual([]);
  });
});
