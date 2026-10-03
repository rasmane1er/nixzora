import { Module } from '@nestjs/common';
import { EmbeddingsModule } from '../ai/embeddings.module';
import { SearchEngine } from './search-engine';

/** The search engine alone (no routes): shared by the API and the search service. */
@Module({
  imports: [EmbeddingsModule],
  providers: [SearchEngine],
  exports: [SearchEngine],
})
export class SearchCoreModule {}
