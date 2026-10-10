import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CatalogModule } from '../catalog/catalog.module';
import { MediaModule } from '../media/media.module';
import { VisualSearchController } from './visual-search.controller';
import { VisualSearchService } from './visual-search.service';

/** Search by photo (ADR-0036). */
@Module({
  imports: [AiModule, CatalogModule, MediaModule],
  controllers: [VisualSearchController],
  providers: [VisualSearchService],
  exports: [VisualSearchService],
})
export class VisualSearchModule {}
