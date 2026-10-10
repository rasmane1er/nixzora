import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { MediaModule } from '../media/media.module';
import {
  ListsController,
  QuestionsController,
  ReviewsController,
  SharedListsController,
  WishlistController,
} from './engagement.controller';
import { ListsService } from './lists.service';
import { QuestionsService } from './questions.service';
import { ReviewsService } from './reviews.service';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [CatalogModule, MediaModule],
  controllers: [
    ReviewsController,
    QuestionsController,
    WishlistController,
    ListsController,
    SharedListsController,
  ],
  providers: [ReviewsService, WishlistService, QuestionsService, ListsService],
  exports: [ReviewsService, QuestionsService],
})
export class EngagementModule {}
