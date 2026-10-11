import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { DevicesModule } from '../devices/devices.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';
import { BuyRemindersController } from './buy-reminders.controller';
import { BuyRemindersService } from './buy-reminders.service';

/** p10-06: back-in-stock and price-drop alerts; p10-36: "Remind me to buy". */
@Module({
  imports: [CatalogModule, DevicesModule],
  controllers: [AlertsController, BuyRemindersController],
  providers: [AlertsService, BuyRemindersService],
  exports: [AlertsService],
})
export class AlertsModule {}
