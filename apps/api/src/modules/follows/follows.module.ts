import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { DevicesModule } from '../devices/devices.module';
import { MediaModule } from '../media/media.module';
import { FollowsController } from './follows.controller';
import { FollowsService } from './follows.service';

/** Follow stores (p10-24, ADR-0046). */
@Module({
  imports: [CatalogModule, DevicesModule, MediaModule],
  controllers: [FollowsController],
  providers: [FollowsService],
})
export class FollowsModule {}
