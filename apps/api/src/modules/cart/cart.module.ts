import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { PlusCoreModule } from '../plus/plus-core.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [MediaModule, PromotionsModule, PlusCoreModule],
  controllers: [CartController],
  providers: [CartService, PricingService],
  exports: [CartService, PricingService],
})
export class CartModule {}
