import { Module } from '@nestjs/common';
import { CartModule } from '../cart/cart.module';
import { InventoryModule } from '../inventory/inventory.module';
import { PaymentsModule } from '../payments/payments.module';
import { PromotionsModule } from '../promotions/promotions.module';
import { RiskModule } from '../risk/risk.module';
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
import { AdminRiskController } from './risk-review.controller';
import { SellerRatingsService } from './seller-ratings.service';

@Module({
  imports: [CartModule, InventoryModule, PaymentsModule, PromotionsModule, RiskModule],
  controllers: [
    CheckoutController,
    AccountOrdersController,
    PaymentsController,
    AdminOrdersController,
    AdminReturnsController,
    AdminRiskController,
  ],
  providers: [OrdersService, OrderEmails, RefundsService, ReturnsService, SellerRatingsService],
  exports: [OrdersService, ReturnsService],
})
export class OrdersModule {}
