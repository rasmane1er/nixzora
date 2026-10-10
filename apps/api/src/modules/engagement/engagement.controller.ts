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
  type ReviewListQuery,
  ReviewListQuerySchema,
  type ReviewModeration,
  ReviewModerationSchema,
  SlugSchema,
  type AnswerCreate,
  AnswerCreateSchema,
  type QuestionCreate,
  QuestionCreateSchema,
  type QuestionListQuery,
  QuestionListQuerySchema,
  type UploadRequest,
  UploadRequestSchema,
} from '@nixzora/validation';
import { z } from 'zod';
import { ApiZodBody } from '../../common/api-docs';
import { perHour } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import {
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  Public,
  RequirePermissions,
} from '../identity/guards/decorators';
import { QuestionsService } from './questions.service';
import { ReviewsService } from './reviews.service';
import { WishlistService } from './wishlist.service';

const slugPipe = new ZodValidationPipe(SlugSchema);

const HelpfulVoteSchema = z.object({ helpful: z.boolean().default(true) });

@ApiTags('reviews')
@Controller({ version: '1' })
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get('catalog/products/:slug/reviews')
  @Public()
  list(
    @Param('slug', slugPipe) slug: string,
    @Query(new ZodValidationPipe(ReviewListQuerySchema)) query: ReviewListQuery,
  ) {
    return this.reviews.forProduct(slug, query);
  }

  @Get('catalog/products/:slug/reviews/mine')
  @ApiBearerAuth()
  mine(@Param('slug', slugPipe) slug: string, @CurrentUser() user: AuthUser) {
    return this.reviews.mine(slug, user);
  }

  /** Create or update your review; it is published after moderation. */
  @Post('catalog/products/:slug/reviews')
  @ApiBearerAuth()
  @RequirePermissions('account.manage.own')
  @Throttle(perHour(10))
  @ApiZodBody(ReviewCreateSchema)
  submit(
    @Param('slug', slugPipe) slug: string,
    @Body(new ZodValidationPipe(ReviewCreateSchema)) body: ReviewCreate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.submit(slug, body, user);
  }

  /** A link to upload a photo for a review (sent with the review as `photoKeys`). */
  @Post('catalog/reviews/photos/upload')
  @ApiBearerAuth()
  @RequirePermissions('account.manage.own')
  @Throttle(perHour(30))
  @ApiZodBody(UploadRequestSchema)
  photoUpload(@Body(new ZodValidationPipe(UploadRequestSchema)) body: UploadRequest) {
    return this.reviews.photoUpload(body.contentType, body.sizeBytes);
  }

  /** "Was this helpful?" — `{ "helpful": false }` takes the vote back. */
  @Post('catalog/reviews/:id/helpful')
  @ApiBearerAuth()
  @RequirePermissions('account.manage.own')
  @HttpCode(HttpStatus.OK)
  @Throttle(perHour(120))
  vote(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(HelpfulVoteSchema)) body: { helpful: boolean },
    @CurrentUser() user: AuthUser,
  ) {
    return this.reviews.vote(id, body.helpful, user);
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

/** Customer questions and answers on product pages (p10-05). */
@ApiTags('reviews')
@Controller({ version: '1' })
export class QuestionsController {
  constructor(private readonly questions: QuestionsService) {}

  @Get('catalog/products/:slug/questions')
  @OptionalAuth()
  list(
    @Param('slug', slugPipe) slug: string,
    @Query(new ZodValidationPipe(QuestionListQuerySchema)) query: QuestionListQuery,
    @MaybeUser() user: AuthUser | undefined,
  ) {
    return this.questions.list(slug, query, user);
  }

  @Post('catalog/products/:slug/questions')
  @ApiBearerAuth()
  @RequirePermissions('account.manage.own')
  @Throttle(perHour(20))
  @ApiZodBody(QuestionCreateSchema)
  ask(
    @Param('slug', slugPipe) slug: string,
    @Body(new ZodValidationPipe(QuestionCreateSchema)) body: QuestionCreate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questions.ask(slug, body.body, user);
  }

  @Post('catalog/questions/:id/answers')
  @ApiBearerAuth()
  @Throttle(perHour(60))
  @ApiZodBody(AnswerCreateSchema)
  answer(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AnswerCreateSchema)) body: AnswerCreate,
    @CurrentUser() user: AuthUser,
  ) {
    return this.questions.answer(id, body.body, user);
  }

  /** Seller portal: questions about the store's products it has not answered yet. */
  @Get('seller/questions')
  @ApiBearerAuth()
  unanswered(@CurrentUser() user: AuthUser) {
    return this.questions.unansweredForMember(user.id);
  }

  @Get('admin/questions')
  @ApiBearerAuth()
  @RequirePermissions('reviews.moderate')
  latest() {
    return this.questions.latest();
  }

  @Post('admin/questions/:id/hide')
  @ApiBearerAuth()
  @RequirePermissions('reviews.moderate')
  @HttpCode(HttpStatus.NO_CONTENT)
  hideQuestion(@Param('id', new ParseUUIDPipe()) id: string, @Actor() actor: ActorContext) {
    return this.questions.hideQuestion(id, actor);
  }

  @Post('admin/answers/:id/hide')
  @ApiBearerAuth()
  @RequirePermissions('reviews.moderate')
  @HttpCode(HttpStatus.NO_CONTENT)
  hideAnswer(@Param('id', new ParseUUIDPipe()) id: string, @Actor() actor: ActorContext) {
    return this.questions.hideAnswer(id, actor);
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
