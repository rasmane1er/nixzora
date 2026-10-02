import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AdminReviewQuery,
  AdminReviewQuerySchema,
  type AdminReviewView,
  type PagedResult,
  type ProductCard,
  type ReviewCreate,
  ReviewCreateSchema,
  type ReviewModeration,
  ReviewModerationSchema,
  SlugSchema,
} from '@nixzora/validation';
import { z } from 'zod';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { CurrentUser, Public, RequirePermissions } from '../identity/guards/decorators';
import { ReviewsService } from './reviews.service';
import { WishlistService } from './wishlist.service';

const slugPipe = new ZodValidationPipe(SlugSchema);
const PageQuery = z.object({ page: z.coerce.number().int().min(1).max(500).default(1) });

@ApiTags('reviews')
@Controller({ version: '1' })
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('catalog/products/:slug/reviews')
  @Public()
  list(
    @Param('slug', slugPipe) slug: string,
    @Query(new ZodValidationPipe(PageQuery)) query: z.infer<typeof PageQuery>,
  ) {
    return this.reviews.forProduct(slug, query.page);
  }

  @Get('catalog/products/:slug/reviews/mine')
  @ApiBearerAuth()
  async mine(@Param('slug', slugPipe) slug: string, @CurrentUser() user: AuthUser) {
    return { review: await this.reviews.mine(slug, user) };
  }

  /** Create or update your review; it is published after moderation. */
  @Post('catalog/products/:slug/reviews')
  @ApiBearerAuth()
  @RequirePermissions('account.manage.own')
  @Throttle({ default: { limit: 10, ttl: 3_600_000 } })
  @ApiZodBody(ReviewCreateSchema)
  submit(
    @Param('slug', slugPipe) slug: string,
    @Body(new ZodValidationPipe(ReviewCreateSchema)) body: ReviewCreate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.submit(slug, body, user);
  }

  @Get('admin/reviews')
  @ApiBearerAuth()
  @RequirePermissions('reviews.moderate')
  queue(
    @Query(new ZodValidationPipe(AdminReviewQuerySchema)) query: AdminReviewQuery,
  ): Promise<PagedResult<AdminReviewView>> {
    return this.reviews.queue(query);
  }

  @Post('admin/reviews/:id/moderation')
  @ApiBearerAuth()
  @RequirePermissions('reviews.moderate')
  @HttpCode(HttpStatus.OK)
  @ApiZodBody(ReviewModerationSchema)
  moderate(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(ReviewModerationSchema)) body: ReviewModeration,
    @Actor() actor: ActorContext,
  ) {
    return this.reviews.moderate(id, body.status, actor);
  }
}

@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me/wishlist', version: '1' })
export class WishlistController {
  constructor(private readonly wishlist: WishlistService) {}

  @Get()
  list(@CurrentUser() user: AuthUser): Promise<ProductCard[]> {
    return this.wishlist.list(user.id);
  }

  @Get('ids')
  ids(@CurrentUser() user: AuthUser): Promise<string[]> {
    return this.wishlist.ids(user.id);
  }

  @Put(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  add(
    @CurrentUser() user: AuthUser,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<void> {
    return this.wishlist.add(user.id, productId);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthUser,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<void> {
    return this.wishlist.remove(user.id, productId);
  }
}
