import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { DevicesModule } from '../devices/devices.module';
import { MediaModule } from '../media/media.module';
import { OrdersModule } from '../orders/orders.module';
import { SellerSubscriptionsController, SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [OrdersModule, CartModule, DevicesModule, MediaModule],
  controllers: [SubscriptionsController, SellerSubscriptionsController],
  providers: [SubscriptionsService],
})
export class SubscriptionsModule {}
