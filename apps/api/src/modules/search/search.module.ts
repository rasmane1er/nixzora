import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { SearchAdminController } from './search-admin.controller';
import { SearchIndexService } from './search-index.service';
import { SearchIndexer } from './search-indexer';

@Module({
  imports: [AiModule],
  controllers: [SearchAdminController],
  providers: [SearchIndexService, SearchIndexer],
  exports: [SearchIndexService],
})
export class SearchModule {}
