import { Module } from '@nestjs/common';
import { SearchAdminController } from './search-admin.controller';
import { SearchCoreModule } from './search-core.module';
import { SearchIndexService } from './search-index.service';
import { SearchIndexer } from './search-indexer';

/** Search inside the API: the client the catalog and assistant use, indexing and admin routes. */
@Module({
  imports: [SearchCoreModule],
  controllers: [SearchAdminController],
  providers: [SearchIndexService, SearchIndexer],
  exports: [SearchIndexService],
})
export class SearchModule {}
