import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { timeDependency } from '../../metrics/metrics';
import { type RetrieveOptions, SearchEngine, type ScoredIds } from './search-engine';

export type { RetrieveOptions, ScoredIds } from './search-engine';

type ReindexResult = { scanned: number; updated: number; skipped: boolean };
type Stats = { products: number; indexed: number; stale: number; model: string };

/** After a failed call, the API stops asking the search service for this long. */
const BREAKER_MS = 30_000;
/** "Is the index ready?" is asked on every search; a yes is trusted for this long. */
const READY_TTL_MS = 60_000;

/**
 * What the rest of the API uses to search (ADR-0015). With SEARCH_SERVICE_URL set, queries and
 * indexing go to the search service over the private network; without it, the same engine runs
 * in-process. If the service is slow or down, searches return nothing here and callers fall back
 * to their own keyword search, so the storefront keeps working.
 */
@Injectable()
export class SearchIndexService {
  private readonly logger = new Logger(SearchIndexService.name);
  private readonly url?: string;
  private readonly key?: string;
  private readonly timeoutMs: number;
  private openUntil = 0;
  private readyUntil = 0;

  constructor(
    private readonly engine: SearchEngine,
    config: ConfigService<Env, true>,
  ) {
    this.url = config.get('SEARCH_SERVICE_URL', { infer: true })?.replace(/\/+$/, '');
    this.key = config.get('INTERNAL_API_KEY', { infer: true });
    this.timeoutMs = config.get('SEARCH_SERVICE_TIMEOUT_MS', { infer: true });
  }

  /** True when queries go to the separate search service. */
  get remote(): boolean {
    return Boolean(this.url);
  }

  async isReady(): Promise<boolean> {
    if (!this.url) return this.engine.isReady();
    if (Date.now() < this.readyUntil) return true;
    const ready = await this.call<{ ready: boolean }>('GET', '/internal/search/ready')
      .then((res) => res.ready)
      .catch(() => false);
    if (ready) this.readyUntil = Date.now() + READY_TTL_MS;
    return ready;
  }

  async hybrid(q: string, options: RetrieveOptions = {}): Promise<ScoredIds> {
    if (!this.url) return this.engine.hybrid(q, options);
    try {
      const res = await this.call<{ results: [string, number][] }>(
        'POST',
        '/internal/search/hybrid',
        { q, options },
      );
      return new Map(res.results);
    } catch {
      return new Map(); // callers fall back to keyword search
    }
  }

  /** Re-indexes one product (catalog outbox events). */
  async indexProduct(productId: string): Promise<boolean> {
    if (!this.url) return this.engine.indexProduct(productId);
    // Throws on failure, so the outbox retries the event later.
    const res = await this.call<{ changed: boolean }>(
      'POST',
      `/internal/search/index/${encodeURIComponent(productId)}`,
      undefined,
      { breaker: false, timeoutMs: 30_000 },
    );
    return res.changed;
  }

  async reindexAll(options: { force?: boolean } = {}): Promise<ReindexResult> {
    if (!this.url) return this.engine.reindexAll(options);
    return this.call<ReindexResult>(
      'POST',
      `/internal/search/reindex${options.force ? '?force=true' : ''}`,
      undefined,
      { breaker: false, timeoutMs: 15 * 60_000 },
    );
  }

  async stats(): Promise<Stats & { service: 'in-process' | 'search-service' }> {
    if (!this.url) return { ...(await this.engine.stats()), service: 'in-process' };
    const stats = await this.call<Stats>('GET', '/internal/search/stats', undefined, {
      breaker: false,
    });
    return { ...stats, service: 'search-service' };
  }

  private async call<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown,
    { breaker = true, timeoutMs = this.timeoutMs } = {},
  ): Promise<T> {
    if (breaker && Date.now() < this.openUntil) throw new Error('search service paused');
    try {
      const res = await timeDependency(
        'search',
        `${method} ${path.split('/').slice(0, 4).join('/')}`,
        () =>
          fetch(`${this.url}${path}`, {
            method,
            headers: {
              'x-internal-key': this.key ?? '',
              ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(timeoutMs),
          }),
      );
      if (!res.ok) throw new Error(`search service answered ${res.status}`);
      return (await res.json()) as T;
    } catch (error) {
      if (breaker) {
        this.openUntil = Date.now() + BREAKER_MS;
        this.logger.warn(
          `Search service unavailable (${(error as Error).message}); keyword search for ${BREAKER_MS / 1000}s`,
        );
      }
      throw error;
    }
  }
}
