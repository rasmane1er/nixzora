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
