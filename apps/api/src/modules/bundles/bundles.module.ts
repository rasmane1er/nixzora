import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import {
  BundlesAdminController,
  BundlesController,
  SellerBundlesController,
} from './bundles.controller';
import { BundlesService } from './bundles.service';

/** Bundle & save (ADR-0038). */
@Module({
  imports: [CatalogModule],
  controllers: [BundlesController, SellerBundlesController, BundlesAdminController],
  providers: [BundlesService],
})
export class BundlesModule {}
