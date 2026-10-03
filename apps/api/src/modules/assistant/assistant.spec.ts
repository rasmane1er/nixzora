import { evidence } from './assistant.service';
import {
  AnthropicLanguageModel,
  type PickFacts,
  groundExplanation,
  templateExplanation,
} from './language-model';
import { matchCategory, parseBudget, parseNeedLocally, stripBudget } from './need';
import { repliesFor, requestLocale } from './replies';
import { toEnglishRequest } from './request-language';

const categories = [
  { slug: 'laptops', name: 'Laptops' },
  { slug: 'headphones', name: 'Headphones' },
  { slug: 'gaming', name: 'Gaming' },
  { slug: 'monitors', name: 'Monitors' },
];

describe('budget parsing', () => {
  it.each([
    ['under $1,500', null, 150_000],
    ['less than 1500 dollars', null, 149_999],
    ['between $200 and $300', 20_000, 30_000],
    ['around $250', 18_750, 28_750],
    ['$1.5k max', null, 150_000],
    ['at least $100', 10_000, null],
    ['a laptop with 32 GB of RAM', null, null],
  ])('%s', (text, min, max) => {
    expect(parseBudget(text)).toEqual({ min, max });
  });

  it('removes budget phrases but keeps specs', () => {
    expect(stripBudget('a 32 GB laptop under $1,500').replace(/\s+/g, ' ').trim()).toBe(
      'a 32 GB laptop',
    );
  });
});

describe('category matching', () => {
  it('uses names, synonyms and prefers product types', () => {
    expect(matchCategory('wireless earbuds for the gym', categories)).toBe('headphones');
    expect(matchCategory('a gaming laptop', categories)).toBe('laptops');
    expect(matchCategory('a gift for my dad', categories)).toBeNull();
  });
});

describe('local need parser', () => {
  it('lets later turns refine earlier ones', () => {
    const need = parseNeedLocally(
      ['A quiet laptop for coding under $1,500', 'actually under $1,000 and lighter'],
      categories,
    );
    expect(need).toMatchObject({
      category: 'laptops',
      minPriceCents: null,
      maxPriceCents: 100_000,
    });
    expect(need.qualities).toEqual(expect.arrayContaining(['quiet', 'developer', 'lightweight']));
    expect(need.query).not.toContain('$');
  });
});

describe('evidence from specs', () => {
  const laptop = {
    attributes: { weight_kg: 1.4, battery_hours: 18, cpu_cores: 12, refresh_hz: 120 },
    text: 'Kestrel 14 Pro developer laptop. Silent under load.',
  };
  it('cites the numbers that make a quality true', () => {
    expect(evidence('lightweight', laptop)).toBe('1.4 kg');
    expect(evidence('battery', laptop)).toBe('18 h battery');
    expect(evidence('developer', laptop)).toBe('12-core CPU');
    expect(evidence('high_refresh', laptop)).toBe('120 Hz display');
    expect(evidence('quiet', laptop)).toBe('silent');
    expect(evidence('noise_cancelling', laptop)).toBeNull();
  });
});

const picks: PickFacts[] = [
  {
    n: 1,
    title: 'Kestrel 14 Pro',
    brand: 'Kestrel',
    price: '$1,149',
    badge: 'Best match',
    matched: [],
    highlights: ['18 h battery'],
  },
  {
    n: 2,
    title: 'Vela 13 Air',
    brand: 'Vela',
    price: '$899',
    badge: 'Best value',
    matched: [],
    highlights: ['0.98 kg'],
  },
];

describe('grounding guardrail', () => {
  it('replaces references with catalog names', () => {
    expect(groundExplanation('[1] has the longest battery; [2] costs $899.', picks)).toBe(
      'The Kestrel 14 Pro has the longest battery; the Vela 13 Air costs $899.',
    );
  });

  it('rejects invented prices and references to products that were not retrieved', () => {
    expect(groundExplanation('[1] is on sale for $999 today.', picks)).toBeNull();
    expect(groundExplanation('[3] is even better.', picks)).toBeNull();
    expect(groundExplanation('', picks)).toBeNull();
  });

  it('explains relaxed requirements in the template answer', () => {
    const text = templateExplanation({
      request: 'laptop under $500',
      needSummary: 'laptops under $500',
      picks: [picks[1]!],
      relaxed: ['your budget'],
    });
    expect(text).toMatch(
      /^Nothing matched everything for laptops under \$500, so I relaxed your budget\./,
    );
    expect(text).toContain('Vela 13 Air');
  });
});

describe('Claude driver', () => {
  function claude(reply: unknown) {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(reply) });
    return {
      model: new AnthropicLanguageModel(
        'sk-ant-test-key',
        'claude-haiku-4-5',
        fetchImpl as unknown as typeof fetch,
      ),
      fetchImpl,
    };
  }

  it('forces a structured tool call and keeps only known categories and qualities', async () => {
    const { model, fetchImpl } = claude({
      content: [
        {
          type: 'tool_use',
          name: 'record_shopping_need',
          input: {
            category: 'tablets',
            max_price_usd: 1500,
            qualities: ['quiet', 'teleportation'],
            search_query: 'quiet laptop',
          },
        },
      ],
      usage: { input_tokens: 420, output_tokens: 60 },
    });
    const { need, usage } = await model.understand(['a quiet laptop under $1,500'], categories);
    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.tool_choice).toEqual({ type: 'tool', name: 'record_shopping_need' });
    expect(need).toEqual({
      category: null,
      minPriceCents: null,
      maxPriceCents: 150_000,
      qualities: ['quiet'],
      query: 'quiet laptop',
    });
    expect(usage).toEqual({ inputTokens: 420, outputTokens: 60 });
  });

  it('asks for the shopper’s language, keeping the structured fields and English prompts', async () => {
    const tool = {
      content: [
        {
          type: 'tool_use',
          name: 'record_shopping_need',
          input: {
            category: 'headphones',
            qualities: ['travel'],
            search_query: 'travel headphones',
          },
        },
      ],
    };
    const english = claude(tool);
    await english.model.understand(['headphones for flights'], categories);
    const englishBody = JSON.parse(
      (english.fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(englishBody.system).not.toMatch(/writes in/);

    const french = claude(tool);
    const { need } = await french.model.understand(['un casque pour l’avion'], categories, 'fr');
    const frenchBody = JSON.parse(
      (french.fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(frenchBody.system).toContain('The shopper writes in French');
    expect(frenchBody.tools).toEqual(englishBody.tools);
    expect(need).toMatchObject({ category: 'headphones', qualities: ['travel'] });

    const spanish = claude({ content: [{ type: 'text', text: '[1] es ideal.' }] });
    await spanish.model.explain({
      request: 'audífonos',
      needSummary: 'audífonos',
      picks,
      relaxed: [],
      locale: 'es',
    });
    const explainBody = JSON.parse(
      (spanish.fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string,
    );
    expect(explainBody.system).toContain('Write your answer in Spanish.');
  });

  it('falls back to the local parser when the tool output is malformed', async () => {
    const { model } = claude({ content: [{ type: 'text', text: 'no tool' }] });
    const { need } = await model.understand(['headphones under $250'], categories);
    expect(need).toMatchObject({ category: 'headphones', maxPriceCents: 25_000 });
  });
});

describe('the shopper’s language', () => {
  it('reads it from Accept-Language, English by default', () => {
    expect(requestLocale('fr-CA,fr;q=0.9,en;q=0.8')).toBe('fr');
    expect(requestLocale('es')).toBe('es');
    expect(requestLocale('de-DE')).toBe('en');
    expect(requestLocale(undefined)).toBe('en');
  });

  it('understands French requests offline', () => {
    const need = parseNeedLocally(
      ['ordinateur portable pour coder moins de 1 500 $'],
      categories,
      'fr',
    );
    expect(need).toEqual({
      category: 'laptops',
      minPriceCents: null,
      maxPriceCents: 150_000,
      qualities: ['developer'],
      query: 'laptop for coding',
    });
    expect(
      parseNeedLocally(['casque sans fil entre 100 et 200 $'], categories, 'fr'),
    ).toMatchObject({
      category: 'headphones',
      minPriceCents: 10_000,
      maxPriceCents: 20_000,
      qualities: ['wireless'],
    });
    expect(
      parseNeedLocally(['un PC portable pas cher pour les jeux, 16 Go de RAM'], categories, 'fr'),
    ).toMatchObject({ category: 'laptops', qualities: ['gaming'] });
    // A follow-up suggestion written by the assistant in French.
    expect(
      parseBudget(toEnglishRequest('Quelque chose de moins cher que 1 149 $US', 'fr')),
    ).toEqual({ min: null, max: 114_899 });
  });

  it('understands Spanish requests offline', () => {
    expect(
      parseNeedLocally(['audífonos para vuelos largos menos de $250'], categories, 'es'),
    ).toEqual({
      category: 'headphones',
      minPriceCents: null,
      maxPriceCents: 25_000,
      qualities: ['travel'],
      query: 'headphones for long flights',
    });
    expect(
      parseNeedLocally(
        ['Una laptop silenciosa para programar, máximo 1500 dólares'],
        categories,
        'es',
      ),
    ).toMatchObject({
      category: 'laptops',
      maxPriceCents: 150_000,
      qualities: expect.arrayContaining(['quiet', 'developer']) as string[],
    });
    expect(parseBudget(toEnglishRequest('Algo más barato que $1,149', 'es'))).toEqual({
      min: null,
      max: 114_899,
    });
  });

  it('leaves English requests exactly as they were, whatever the header', () => {
    for (const text of ['A quiet laptop for coding under $1,500', 'a portable speaker, 1500 $']) {
      expect(toEnglishRequest(text, 'en')).toBe(text);
    }
    expect(parseNeedLocally(['A quiet laptop for coding under $1,500'], categories, 'fr')).toEqual(
      parseNeedLocally(['A quiet laptop for coding under $1,500'], categories),
    );
  });

  it('cites specs in the shopper’s language', () => {
    const laptop = { attributes: { weight_kg: 1.4, battery_hours: 18, cpu_cores: 12 }, text: '' };
    expect(evidence('lightweight', laptop, 'fr')).toBe('1,4 kg');
    expect(evidence('battery', laptop, 'fr')).toBe('autonomie de 18 h');
    expect(evidence('developer', laptop, 'es')).toBe('CPU de 12 núcleos');
  });

  it('writes the template answer in French and Spanish', () => {
    const localized = (locale: 'fr' | 'es') => {
      const r = repliesFor(locale);
      return picks.map((p, i) => ({
        ...p,
        price: r.money(i === 0 ? 114_900 : 89_900),
        badge: r.t(i === 0 ? 'badgeBestMatch' : 'badgeBestValue'),
      }));
    };
    const fr = templateExplanation({
      request: 'portable',
      needSummary: 'ordinateurs portables à moins de 1 500 $US',
      picks: localized('fr'),
      relaxed: [],
      locale: 'fr',
    });
    // Intl writes French amounts with narrow no-break spaces.
    expect(fr.replace(/[\u00a0\u202f]/g, ' ')).toBe(
      'Voici 2 suggestions pour ordinateurs portables à moins de 1 500 $US. Kestrel 14 Pro est le meilleur choix, à 1 149 $US : 18 h battery. Vela 13 Air (meilleur rapport qualité-prix) coûte 899 $US, avec 0.98 kg.',
    );
    const es = templateExplanation({
      request: 'laptop',
      needSummary: 'laptops por menos de $500',
      picks: [localized('es')[1]!],
      relaxed: [repliesFor('es').t('relaxedBudget')],
      locale: 'es',
    });
    expect(es).toMatch(
      /^Nada cumplía todo lo que pediste para laptops por menos de \$500, así que flexibilicé tu presupuesto\. Esta es la opción más cercana\./,
    );
  });

  it('grounds French and Spanish model answers, prices in local formats included', () => {
    const fr = picks.map((p, i) => ({ ...p, price: repliesFor('fr').money(i ? 89_900 : 114_900) }));
    expect(groundExplanation('[1] tient le plus longtemps ; [2] coûte 899 $US.', fr, 'fr')).toBe(
      'Kestrel 14 Pro tient le plus longtemps ; Vela 13 Air coûte 899 $US.',
    );
    expect(groundExplanation('[2] coûte 799 $ aujourd’hui.', fr, 'fr')).toBeNull();
    expect(groundExplanation('[2] cuesta 1.149 dólares.', picks, 'es')).not.toBeNull();
    expect(groundExplanation('[2] cuesta 999 dólares.', picks, 'es')).toBeNull();
    expect(groundExplanation('[3] es mejor.', picks, 'es')).toBeNull();
  });
});
