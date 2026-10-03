import { type ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { AnthropicLanguageModel, LocalLanguageModel } from '../assistant/language-model';
import { AiGatewayClient, RemoteEmbeddings, RemoteLanguageModel } from './ai-gateway';
import { embeddingsFor, languageModelFor } from './providers';
import { costMicros, priceOf } from './ai-usage.service';
import { conceptOf, conceptsIn, editDistance, stem, tokenize } from './concepts';
import {
  EMBEDDING_DIMENSIONS,
  LocalEmbeddings,
  VoyageEmbeddings,
  contentHash,
  cosine,
  localVector,
  toPgVector,
} from './embeddings';

describe('shopping vocabulary', () => {
  it('tokenizes, glues units and drops filler words', () => {
    expect(tokenize('A laptop with 32 GB of RAM, under $1,500!')).toEqual([
      'laptop',
      '32gb',
      'ram',
      '1',
      '500',
    ]);
  });

  it('stems plurals', () => {
    expect(stem('laptops')).toBe('laptop');
    expect(stem('batteries')).toBe('battery');
    expect(stem('glass')).toBe('glass');
  });

  it('maps synonyms and one-letter typos to the same concept', () => {
    expect(conceptOf('fanless')).toBe('quiet');
    expect(conceptOf('earbuds')).toBe('headphones');
    expect(conceptOf('hedphones')).toBe('headphones');
    expect(conceptOf('mic')).toBeUndefined();
    expect(conceptsIn('noise-cancelling headphones for flights')).toEqual(
      expect.arrayContaining(['noise_cancelling', 'headphones', 'travel']),
    );
  });

  it('measures edit distance with adjacent swaps', () => {
    expect(editDistance('laptop', 'labtop')).toBe(1);
    expect(editDistance('laptop', 'lpatop')).toBe(1);
    expect(editDistance('laptop', 'desktop', 2)).toBe(3);
  });
});

describe('local embeddings', () => {
  it('returns deterministic unit vectors of the index dimension', async () => {
    const [a, b] = await new LocalEmbeddings().embed(['quiet laptop', 'quiet laptop'], 'query');
    expect(a).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(Math.hypot(...a!)).toBeCloseTo(1, 6);
    expect(a).toEqual(b);
  });

  it('puts related requests closer than unrelated ones', () => {
    const query = localVector('something silent to carry on a plane');
    const related = localVector('Fanless ultralight laptop, under a kilogram, great for travel');
    const unrelated = localVector('Mid-tower gaming desktop with RGB lighting');
    expect(cosine(query, related)).toBeGreaterThan(cosine(query, unrelated) + 0.1);
  });

  it('writes pgvector literals and stable content hashes', () => {
    expect(toPgVector([0.5, -0.25])).toBe('[0.500000,-0.250000]');
    expect(contentHash('a', 'm1')).toBe(contentHash('a', 'm1'));
    expect(contentHash('a', 'm1')).not.toBe(contentHash('a', 'm2'));
  });
});

describe('Voyage embeddings', () => {
  it('asks for 512 dimensions with the right input type and keeps input order', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          data: [
            { index: 1, embedding: [0, 2] },
            { index: 0, embedding: [3, 4] },
          ],
          usage: { total_tokens: 12 },
        }),
    });
    const voyage = new VoyageEmbeddings(
      'vk-test-key-123',
      'voyage-4-lite',
      fetchImpl as unknown as typeof fetch,
    );
    const vectors = await voyage.embed(['first', 'second'], 'document');
    const body = JSON.parse((fetchImpl.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({
      model: 'voyage-4-lite',
      input_type: 'document',
      output_dimension: 512,
    });
    expect(vectors).toEqual([
      [0.6, 0.8],
      [0, 1],
    ]);
    expect(voyage.lastTokens).toBe(12);
  });

  it('fails loudly on an HTTP error', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    const voyage = new VoyageEmbeddings(
      'vk-test-key-123',
      'voyage-4-lite',
      fetchImpl as unknown as typeof fetch,
    );
    await expect(voyage.embed(['x'], 'query')).rejects.toThrow('HTTP 401');
  });
});

describe('AI pricing', () => {
  it('prices known models, dated snapshots and the free local driver', () => {
    expect(costMicros('claude-haiku-4-5', 1_000, 200)).toBe(2_000);
    expect(priceOf('claude-haiku-4-5-20251001')).toEqual([1, 5]);
    expect(costMicros('local', 5_000, 5_000)).toBe(0);
    expect(priceOf('some-future-model')).toEqual([2, 10]);
  });
});

describe('provider selection (ADR-0016)', () => {
  const config = (env: Record<string, unknown>) =>
    ({ get: (key: string) => env[key] }) as unknown as ConfigService<Env, true>;
  const remote = {
    AI_SERVICE_URL: 'http://ai.internal:4200',
    INTERNAL_API_KEY: 'k'.repeat(40),
    AI_SERVICE_TIMEOUT_MS: 30_000,
  };

  it('keeps the free local drivers in-process, even with an AI service', () => {
    const env = config({ ...remote, AI_DRIVER: 'local', EMBEDDINGS_DRIVER: 'local' });
    expect(languageModelFor(env)).toBeInstanceOf(LocalLanguageModel);
    expect(embeddingsFor(env)).toBeInstanceOf(LocalEmbeddings);
  });

  it('sends paid providers through the AI service, with the configured model names', () => {
    const env = config({
      ...remote,
      AI_DRIVER: 'anthropic',
      AI_MODEL: 'claude-haiku-4-5',
      EMBEDDINGS_DRIVER: 'voyage',
      VOYAGE_MODEL: 'voyage-4-lite',
    });
    const llm = languageModelFor(env);
    const embeddings = embeddingsFor(env);
    expect(llm).toBeInstanceOf(RemoteLanguageModel);
    expect([llm.driver, llm.model]).toEqual(['anthropic', 'claude-haiku-4-5']);
    expect(embeddings).toBeInstanceOf(RemoteEmbeddings);
    expect([embeddings.driver, embeddings.model]).toEqual(['voyage', 'voyage-4-lite']);
  });

  it('calls providers directly without an AI service', () => {
    const env = config({
      AI_DRIVER: 'anthropic',
      ANTHROPIC_API_KEY: 'sk-test-key',
      AI_MODEL: 'claude-haiku-4-5',
      EMBEDDINGS_DRIVER: 'voyage',
      VOYAGE_API_KEY: 'pa-test-key',
      VOYAGE_MODEL: 'voyage-4-lite',
    });
    expect(languageModelFor(env)).toBeInstanceOf(AnthropicLanguageModel);
    expect(embeddingsFor(env)).toBeInstanceOf(VoyageEmbeddings);
  });

  it('passes remote tokens to the usage log and model mismatches to the caller', async () => {
    const fetchImpl = jest.fn(async () =>
      Response.json({ vectors: [[1, 0]], tokens: 7 }, { status: 200 }),
    ) as unknown as typeof fetch;
    const client = new AiGatewayClient('http://ai/', 'k', 1000, fetchImpl);
    const embeddings = new RemoteEmbeddings(client, 'voyage', 'voyage-4-lite');
    expect(await embeddings.embed(['a'], 'query')).toEqual([[1, 0]]);
    expect(embeddings.lastTokens).toBe(7);
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0];
    expect(url).toBe('http://ai/internal/ai/embed');
    expect(JSON.parse(init.body)).toMatchObject({ model: 'voyage-4-lite', purpose: 'query' });
    expect(init.headers['x-internal-key']).toBe('k');

    const refusing = new AiGatewayClient(
      'http://ai',
      'k',
      1000,
      (async () => new Response('{}', { status: 409 })) as unknown as typeof fetch,
    );
    await expect(
      new RemoteLanguageModel(refusing, 'anthropic', 'x').explain({
        request: 'r',
        needSummary: 's',
        picks: [],
        relaxed: [],
      }),
    ).rejects.toThrow('409');
  });
});
