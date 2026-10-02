/**
 * Rebuilds the search index (ADR-0009): embeds products whose text or model changed.
 *
 *   pnpm --filter @nixzora/api search:reindex          # changed products only
 *   pnpm --filter @nixzora/api search:reindex --force  # every product (after a model change)
 */
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SearchIndexService } from '../modules/search/search-index.service';

async function main(): Promise<void> {
  process.env.LOG_LEVEL ??= 'warn';
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
  try {
    const result = await app
      .get(SearchIndexService)
      .reindexAll({ force: process.argv.includes('--force') });
    if (result.skipped) console.warn('Another reindex is running; nothing to do.');
    else console.warn(`Indexed ${result.updated} of ${result.scanned} products.`);
  } finally {
    await app.close();
  }
}

void main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
