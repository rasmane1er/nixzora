import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PricingService } from './pricing.service';

@Module({
  imports: [MediaModule, PromotionsModule],
  controllers: [CartController],
  providers: [CartService, PricingService],
  exports: [CartService, PricingService],
})
export class CartModule {}
