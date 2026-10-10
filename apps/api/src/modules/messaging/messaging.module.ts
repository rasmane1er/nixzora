import { Module } from '@nestjs/common';
import { DevicesModule } from '../devices/devices.module';
import { MediaModule } from '../media/media.module';
import {
  AdminMessagesController,
  CustomerMessagesController,
  SellerMessagesController,
} from './messaging.controller';
import { MessagingService } from './messaging.service';

@Module({
  imports: [DevicesModule, MediaModule],
  controllers: [CustomerMessagesController, SellerMessagesController, AdminMessagesController],
  providers: [MessagingService],
})
export class MessagingModule {}
