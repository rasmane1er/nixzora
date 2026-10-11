import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { DevicesModule } from '../devices/devices.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

/** p10-33: warranty tracker, and warranty and return-window reminders. */
@Module({
  imports: [CatalogModule, DevicesModule],
  controllers: [RemindersController],
  providers: [RemindersService],
  exports: [RemindersService],
})
export class RemindersModule {}
