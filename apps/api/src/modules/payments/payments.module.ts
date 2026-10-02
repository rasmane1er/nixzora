import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { FakeGateway } from './fake.gateway';
import { PAYMENT_GATEWAY } from './payment-gateway';
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
  ],
  exports: [PAYMENT_GATEWAY],
})
export class PaymentsModule {}
