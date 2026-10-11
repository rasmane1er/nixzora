import { Module } from '@nestjs/common';
import {
  SellerSpendOffersController,
  SpendOffersAdminController,
  SpendOffersController,
} from './spend-offers.controller';
import { SpendOffersService } from './spend-offers.service';

/** Spend more, save more (ADR-0054). */
@Module({
  controllers: [SpendOffersController, SellerSpendOffersController, SpendOffersAdminController],
  providers: [SpendOffersService],
  exports: [SpendOffersService],
})
export class SpendOffersModule {}
