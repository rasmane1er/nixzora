import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { OrderEmails } from './order-emails';
import {
  AccountOrdersController,
  AdminOrdersController,
  AdminReturnsController,
  CheckoutController,
  PaymentsController,
} from './orders.controller';
import { OrdersService } from './orders.service';
import { RefundsService } from './refunds.service';
import { ReturnsService } from './returns.service';

@Module({
  imports: [CartModule, InventoryModule, PaymentsModule, PromotionsModule],
  controllers: [
    CheckoutController,
    AccountOrdersController,
    PaymentsController,
    AdminOrdersController,
    AdminReturnsController,
  ],
  providers: [OrdersService, OrderEmails, RefundsService, ReturnsService],
  exports: [OrdersService],
})
export class OrdersModule {}
