import { createHash } from 'node:crypto';
import { CONCEPTS_VERSION, conceptOf, stem, tokenize } from './concepts';

/** Every embedding in the search index has this many dimensions (vector(512) column). */
export const EMBEDDING_DIMENSIONS = 512;

export const EMBEDDINGS = Symbol('EMBEDDINGS');

export type EmbeddingPurpose = 'query' | 'document';

export interface EmbeddingsProvider {
  /** Recorded on each indexed row; a different model means the row is re-embedded. */
  readonly model: string;
  readonly driver: 'local' | 'voyage';
  /** Tokens used by the last embed() call (paid providers), for the AI usage log. */
  readonly lastTokens?: number;
  /** Unit-length vectors of EMBEDDING_DIMENSIONS numbers, one per input, in order. */
  embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]>;
}

/**
 * Offline embeddings: signed feature hashing of words, shopping concepts and character
 * trigrams. Not a language model, but it is deterministic, free and needs no network, so
 * development, CI and the demo work without keys (ADR-0009):
 * - concepts make "quiet laptop for flights" land near "fanless ultralight for travel";
 * - trigrams give some typo tolerance ("hedphones" ≈ "headphones");
 * - words keep exact names (brands, model numbers) strong.
 */
export class LocalEmbeddings implements EmbeddingsProvider {
  readonly model = `local-hash-v1-${CONCEPTS_VERSION}`;
  readonly driver = 'local' as const;

  embed(texts: string[], _purpose?: EmbeddingPurpose): Promise<number[][]> {
    return Promise.resolve(texts.map((text) => localVector(text)));
  }
}

const WEIGHT = { concept: 2.2, word: 1, trigram: 0.25 };

export function localVector(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const add = (feature: string, weight: number) => {
    const digest = createHash('sha1').update(feature).digest();
    const index = digest.readUInt32BE(0) % EMBEDDING_DIMENSIONS;
    const sign = digest[4]! & 1 ? 1 : -1;
    vector[index]! += sign * weight;
  };

  for (const raw of tokenize(text)) {
    const word = stem(raw);
    add(`w:${word}`, WEIGHT.word);
    const concept = conceptOf(raw);
    if (concept) add(`c:${concept}`, WEIGHT.concept);
    if (word.length >= 4 && !/^\d/.test(word)) {
      const padded = `^${word}$`;
      for (let i = 0; i + 3 <= padded.length; i++)
        add(`t:${padded.slice(i, i + 3)}`, WEIGHT.trigram);
    }
  }
  return normalize(vector);
}

export function normalize(vector: number[]): number[] {
  const length = Math.hypot(...vector);
  return length > 0 ? vector.map((value) => value / length) : vector;
}

export function cosine(a: number[], b: number[]): number {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i]! * b[i]!;
  return dot;
}

/** pgvector's text format: "[0.1,0.2,…]". */
export function toPgVector(vector: number[]): string {
  return `[${vector.map((value) => (Number.isFinite(value) ? value.toFixed(6) : '0')).join(',')}]`;
}

type VoyageResponse = {
  data: { embedding: number[]; index: number }[];
  usage?: { total_tokens?: number };
};

/** Voyage AI embeddings (Anthropic's recommended embeddings provider). */
export class VoyageEmbeddings implements EmbeddingsProvider {
  readonly driver = 'voyage' as const;
  /** Tokens used by the last call, for the AI usage log. */
  lastTokens = 0;

  constructor(
    private readonly apiKey: string,
    readonly model: string,
    private readonly fetchImpl: typeof fetch = (...args) => fetch(...args),
  ) {}

  async embed(texts: string[], purpose: EmbeddingPurpose): Promise<number[][]> {
    if (!texts.length) return [];
    const out: number[][] = [];
    this.lastTokens = 0;
    // The API accepts up to 1,000 inputs per request; batches of 100 keep requests small.
    for (let start = 0; start < texts.length; start += 100) {
      const batch = texts.slice(start, start + 100);
      const res = await this.fetchImpl('https://api.voyageai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${this.apiKey}` },
        body: JSON.stringify({
          input: batch,
          model: this.model,
          input_type: purpose,
          output_dimension: EMBEDDING_DIMENSIONS,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Voyage embeddings failed with HTTP ${res.status}`);
      const body = (await res.json()) as VoyageResponse;
      this.lastTokens += body.usage?.total_tokens ?? 0;
      const sorted = [...body.data].sort((a, b) => a.index - b.index);
      if (sorted.length !== batch.length)
        throw new Error('Voyage returned the wrong number of embeddings');
      out.push(...sorted.map((item) => normalize(item.embedding)));
    }
    return out;
  }
}

/** sha256 of the text plus model, stored with each row to skip unchanged products. */
export function contentHash(text: string, model: string): string {
  return createHash('sha256').update(model).update('\0').update(text).digest('hex');
}
