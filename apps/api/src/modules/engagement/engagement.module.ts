import { Module } from '@nestjs/common';
import { CatalogModule } from '../catalog/catalog.module';
import { ReviewsController, WishlistController } from './engagement.controller';
import { ReviewsService } from './reviews.service';
import { WishlistService } from './wishlist.service';

@Module({
  imports: [CatalogModule],
  controllers: [ReviewsController, WishlistController],
  providers: [ReviewsService, WishlistService],
  exports: [ReviewsService],
})
export class EngagementModule {}
