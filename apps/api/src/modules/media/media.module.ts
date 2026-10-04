import { Module } from '@nestjs/common';
import { MediaController } from './media.controller';
import { MediaIntakeService } from './media-intake.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [MediaController],
  providers: [StorageService, MediaIntakeService],
  exports: [StorageService, MediaIntakeService],
})
export class MediaModule {}
