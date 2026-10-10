import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MediaModule } from '../media/media.module';
import { RecommendationsModule } from '../recommendations/recommendations.module';
import { SellersModule } from '../sellers/sellers.module';
import { AdCampaignsService } from './ad-campaigns.service';
import { AdsAdminController, AdsController, SellerAdsController } from './ads.controller';
import { AdsService } from './ads.service';

/** p10-01: sponsored products, paid per click from seller earnings. */
@Module({
  imports: [CatalogModule, MediaModule, RecommendationsModule, SellersModule],
  controllers: [AdsController, SellerAdsController, AdsAdminController],
  providers: [AdsService, AdCampaignsService],
})
export class AdvertisingModule {}
