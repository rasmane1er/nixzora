import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MediaModule } from '../media/media.module';
import { DealsAdminController, DealsController, SellerDealsController } from './deals.controller';
import { DealsService } from './deals.service';

/** p10-07: limited-time deals. */
@Module({
  imports: [CatalogModule, MediaModule],
  controllers: [DealsController, SellerDealsController, DealsAdminController],
  providers: [DealsService],
  exports: [DealsService],
})
export class DealsModule {}
