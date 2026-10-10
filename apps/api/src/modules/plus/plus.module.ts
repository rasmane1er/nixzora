import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminPlusController, PlusController } from './plus.controller';
import { PlusCoreModule } from './plus-core.module';
import { PlusService } from './plus.service';

/** NIXZORA Plus membership and billing (ADR-0037). */
@Module({
  imports: [OrdersModule, DevicesModule, PlusCoreModule],
  controllers: [PlusController, AdminPlusController],
  providers: [PlusService],
  exports: [PlusService],
})
export class PlusModule {}
