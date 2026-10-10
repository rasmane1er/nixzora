import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { PlusCoreModule } from '../plus/plus-core.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { CartController } from './cart.controller';
import { CartService } from './cart.service';
import { PricingService } from './pricing.service';
import { SavedController } from './saved.controller';
import { SavedService } from './saved.service';

@Module({
  imports: [MediaModule, PromotionsModule, PlusCoreModule],
  controllers: [CartController, SavedController],
  providers: [CartService, PricingService, SavedService],
  exports: [CartService, PricingService],
})
export class CartModule {}
