import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { InsightsModule } from '../insights/insights.module';
import { InventoryModule } from '../inventory/inventory.module';
import { MediaModule } from '../media/media.module';
import { PaymentsModule } from '../payments/payments.module';
import { PayoutsService } from './payouts.service';
import { SellerAnalyticsService } from './seller-analytics.service';
import { SellerImportService } from './seller-import.service';
import { SellerListingsService } from './seller-listings.service';
import { SellerOrdersService } from './seller-orders.service';
import { SellerController } from './seller.controller';
import { SellersAdminController } from './sellers-admin.controller';
import { SellersAdminService } from './sellers-admin.service';
import { SellersPublicController } from './sellers-public.controller';
import { SellersService } from './sellers.service';

/** Marketplace sellers (Phase 7, ADR-0012). */
@Module({
  imports: [CatalogModule, InsightsModule, InventoryModule, MediaModule, PaymentsModule],
  controllers: [SellerController, SellersAdminController, SellersPublicController],
  providers: [
    SellersService,
    SellerListingsService,
    SellerOrdersService,
    SellersAdminService,
    PayoutsService,
    SellerImportService,
    SellerAnalyticsService,
  ],
  exports: [SellersService],
})
export class SellersModule {}
