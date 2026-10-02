import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { OrderPush } from './order-push';
import { PushService } from './push.service';

@Module({
  controllers: [DevicesController],
  providers: [PushService, OrderPush],
  exports: [PushService],
})
export class DevicesModule {}
