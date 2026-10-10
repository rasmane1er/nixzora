import { Module } from '@nestjs/common';
import { AdminSizeChartsController, SellerSizeChartsController } from './size-charts.controller';
import { SizeChartsService } from './size-charts.service';

/** Size & fit guide (p10-26, ADR-0048): size charts for stores and NIXZORA. */
@Module({
  controllers: [SellerSizeChartsController, AdminSizeChartsController],
  providers: [SizeChartsService],
})
export class SizeGuideModule {}
