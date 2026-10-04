import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { FakePayoutGateway } from './fake-payout.gateway';
import { FakeGateway } from './fake.gateway';
import { PAYMENT_GATEWAY } from './payment-gateway';
import { PAYOUT_GATEWAY } from './payout-gateway';
import { StripePayoutGateway } from './stripe-payout.gateway';
import { StripeGateway } from './stripe.gateway';

@Module({
  providers: [
    {
      provide: PAYMENT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('PAYMENTS_PROVIDER', { infer: true }) === 'stripe'
          ? new StripeGateway(
              config.get('STRIPE_SECRET_KEY', { infer: true })!,
              config.get('STRIPE_PUBLISHABLE_KEY', { infer: true })!,
              config.get('STRIPE_WEBHOOK_SECRET', { infer: true })!,
            )
          : new FakeGateway(),
    },
    {
      provide: PAYOUT_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        config.get('PAYOUTS_PROVIDER', { infer: true }) === 'stripe'
          ? new StripePayoutGateway(
              config.get('STRIPE_SECRET_KEY', { infer: true })!,
              config.get('STRIPE_CONNECT_WEBHOOK_SECRET', { infer: true }),
            )
          : new FakePayoutGateway(),
    },
  ],
  exports: [PAYMENT_GATEWAY, PAYOUT_GATEWAY],
})
export class PaymentsModule {}
