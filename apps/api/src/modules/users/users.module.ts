import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { UsersAdminController } from './users-admin.controller';
import { OpsSummaryService } from './ops-summary.service';
import { UsersAdminService } from './users-admin.service';

@Module({
  imports: [InventoryModule],
  controllers: [UsersAdminController],
  providers: [UsersAdminService, OpsSummaryService],
})
export class UsersModule {}
