import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { DevicesModule } from '../devices/devices.module';
import { AlertsController } from './alerts.controller';
import { AlertsService } from './alerts.service';

/** p10-06: back-in-stock and price-drop alerts. */
@Module({
  imports: [CatalogModule, DevicesModule],
  controllers: [AlertsController],
  providers: [AlertsService],
  exports: [AlertsService],
})
export class AlertsModule {}
