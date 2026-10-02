import { evidence } from './assistant.service';
import {
  AnthropicLanguageModel,
  type PickFacts,
  groundExplanation,
  templateExplanation,
} from './language-model';
import { matchCategory, parseBudget, parseNeedLocally, stripBudget } from './need';

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

  it('falls back to the local parser when the tool output is malformed', async () => {
    const { model } = claude({ content: [{ type: 'text', text: 'no tool' }] });
    const { need } = await model.understand(['headphones under $250'], categories);
    expect(need).toMatchObject({ category: 'headphones', maxPriceCents: 25_000 });
  });
});
