import { Module } from '@nestjs/common';
import { InventoryModule } from '../inventory/inventory.module';
import { UsersAdminController } from './users-admin.controller';
import { UsersAdminService } from './users-admin.service';

@Module({
  imports: [InventoryModule],
  controllers: [UsersAdminController],
  providers: [UsersAdminService],
})
export class UsersModule {}
