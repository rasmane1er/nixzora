import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { PriceHistoryController } from './price-history.controller';
import { PriceHistoryService } from './price-history.service';

/** Price history and browsing history (ADR-0041). */
@Module({
  imports: [CatalogModule],
  controllers: [PriceHistoryController],
  providers: [PriceHistoryService],
  exports: [PriceHistoryService],
})
export class PriceHistoryModule {}
