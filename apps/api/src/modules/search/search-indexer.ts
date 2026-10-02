import { Injectable, Logger, type OnApplicationBootstrap, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { OutboxService } from '../outbox/outbox.service';
import { SearchIndexService } from './search-index.service';

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
    for (const type of ['catalog.product.created', 'catalog.product.updated']) {
      this.outbox.on(type, async (event) => {
        await this.index.indexProduct(event.aggregateId);
      });
    }
  }

  onApplicationBootstrap(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
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
