import { Module } from '@nestjs/common';
import { PaymentsModule } from '../payments/payments.module';
import { RiskService } from './risk.service';

/** Fraud signals (ADR-0024). The review endpoints live with orders, which cancel confirmed fraud. */
@Module({
  imports: [PaymentsModule],
  providers: [RiskService],
  exports: [RiskService],
})
export class RiskModule {}
