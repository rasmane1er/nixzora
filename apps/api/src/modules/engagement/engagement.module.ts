import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MediaModule } from '../media/media.module';
import {
  QuestionsController,
  ReviewsController,
  WishlistController,
} from './engagement.controller';
import { QuestionsService } from './questions.service';
import { ReviewsService } from './reviews.service';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [CatalogModule, MediaModule],
  controllers: [ReviewsController, QuestionsController, WishlistController],
  providers: [ReviewsService, WishlistService, QuestionsService],
  exports: [ReviewsService, QuestionsService],
})
export class EngagementModule {}
