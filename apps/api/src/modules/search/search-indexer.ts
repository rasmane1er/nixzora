import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { OutboxService } from '../outbox/outbox.service';
import { SearchIndexService } from './search-index.service';
import { runsBackgroundJobs } from '../../common/background-jobs';

/**
 * Keeps the search index current: catalog outbox events re-index one product, and a background
 * pass at startup catches anything else (brand or category renames, a new embedding model).
 */
@Injectable()
export class SearchIndexer implements OnModuleInit, OnApplicationBootstrap {
  private readonly logger = new Logger(SearchIndexer.name);

  constructor(
    private readonly outbox: OutboxService,
    private readonly index: SearchIndexService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    // With SEARCH_INDEX_EVENTS=kafka the index owner reads product events from Kafka instead.
    if (
      this.config.get('SEARCH_INDEX_EVENTS', { infer: true }) === 'kafka' &&
      this.config.get('KAFKA_BROKERS', { infer: true }).length
    ) {
      return;
    }
    for (const type of ['catalog.product.created', 'catalog.product.updated']) {
      this.outbox.on(type, async (event) => {
        await this.index.indexProduct(event.aggregateId);
      });
    }
  }

  onApplicationBootstrap(): void {
    if (!runsBackgroundJobs(this.config)) return;
    // A separate search service runs this pass itself when it starts.
    if (this.index.remote) return;
    // Not awaited: the API starts serving at once; search falls back to keywords meanwhile.
    void this.index
      .reindexAll()
      .then((result) => {
        if (!result.skipped)
          this.logger.log(`Search index: ${result.updated} of ${result.scanned} products updated`);
      })
      .catch((error: Error) => this.logger.error(`Search reindex failed: ${error.message}`));
  }
}
