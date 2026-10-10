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
  PaymentCardsController,
  PaymentsController,
} from './orders.controller';
import { OrdersService } from './orders.service';
import { PaymentCardsService } from './payment-cards.service';
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
    PaymentCardsController,
    AdminOrdersController,
    AdminReturnsController,
    AdminRiskController,
  ],
  providers: [
    OrdersService,
    OrderEmails,
    RefundsService,
    ReturnsService,
    SellerRatingsService,
    PaymentCardsService,
  ],
  exports: [OrdersService, ReturnsService, PaymentCardsService],
})
export class OrdersModule {}
