import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import {
  ClipCouponsAdminController,
  ClipCouponsController,
  SellerClipCouponsController,
} from './clip-coupons.controller';
import { ClipCouponsService } from './clip-coupons.service';

/** Clip coupons (ADR-0040). */
@Module({
  imports: [CatalogModule],
  controllers: [ClipCouponsController, SellerClipCouponsController, ClipCouponsAdminController],
  providers: [ClipCouponsService],
})
export class ClipCouponsModule {}
