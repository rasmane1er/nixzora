import { Module } from '@nestjs/common';
import { MediaModule } from '../media/media.module';
import { OrdersModule } from '../orders/orders.module';
import { AccountHubController } from './account-hub.controller';
import { AccountHubService } from './account-hub.service';
import { AddressesController } from './addresses.controller';

@Module({
  imports: [MediaModule, OrdersModule],
  controllers: [AddressesController, AccountHubController],
  providers: [AccountHubService],
})
export class CustomersModule {}
