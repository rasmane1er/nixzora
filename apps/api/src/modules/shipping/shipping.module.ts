import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { EasyPostGateway } from './easypost.gateway';
import { FakeShippingGateway } from './fake-shipping.gateway';
import { LabelsService } from './labels.service';
import { ShippingController } from './shipping.controller';
import { NoShippingGateway, SHIPPING_GATEWAY } from './shipping-gateway';

@Module({
  controllers: [ShippingController],
  providers: [
    LabelsService,
    {
      provide: SHIPPING_GATEWAY,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        switch (config.get('SHIPPING_PROVIDER', { infer: true })) {
          case 'easypost':
            return new EasyPostGateway(
              config.get('EASYPOST_API_KEY', { infer: true })!,
              config.get('EASYPOST_WEBHOOK_SECRET', { infer: true }),
            );
          case 'none':
            return new NoShippingGateway();
          default:
            return new FakeShippingGateway(
              config.get('API_PUBLIC_URL', { infer: true }),
              config.get('ORDER_LINK_SECRET', { infer: true }),
            );
        }
      },
    },
  ],
})
export class ShippingModule {}
