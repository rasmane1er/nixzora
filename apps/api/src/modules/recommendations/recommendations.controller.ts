import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  CartIdSchema,
  type ProductViewEvent,
  ProductViewEventSchema,
  type Recommendations,
  RecommendationsSchema,
  type RelatedProducts,
  RelatedProductsSchema,
  type SearchEvent,
  SearchEventSchema,
  VisitorIdSchema,
} from '@nixzora/validation';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, MaybeUser, OptionalAuth, Public } from '../identity/guards/decorators';
import { RecommendationsService } from './recommendations.service';

const OptionalVisitor = VisitorIdSchema.optional();
const OptionalCart = CartIdSchema.optional();

@ApiTags('recommendations')
@Controller({ version: '1' })
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  /** A shopper opened a product page (p6-08). Guests send their random visitor id. */
  @OptionalAuth()
  @Post('events/views')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(60))
  @ApiZodBody(ProductViewEventSchema)
  async view(
    @Body(new ZodValidationPipe(ProductViewEventSchema)) body: ProductViewEvent,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<void> {
    await this.recommendations.recordView(
      body.productId,
      { userId: user?.id, visitorId: body.visitorId },
      body.source,
    );
  }

  /** A shopper searched (p10-02), for "Because you searched for…". Guests send their visitor id. */
  @OptionalAuth()
  @Post('events/searches')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle(perMinute(60))
  @ApiZodBody(SearchEventSchema)
  async search(
    @Body(new ZodValidationPipe(SearchEventSchema)) body: SearchEvent,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<void> {
    await this.recommendations.recordInterest(body.q, 'SEARCH', {
      userId: user?.id,
      visitorId: body.visitorId,
    });
  }

  /** Forgets this customer's (and this device's) product views, searches and needs. */
  @Delete('me/shopping-history')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearHistory(
    @CurrentUser() user: AuthUser,
    @Query('visitorId') rawVisitorId: string | undefined,
  ): Promise<void> {
    const visitorId = OptionalVisitor.safeParse(rawVisitorId).data;
    await this.recommendations.clearHistory({ userId: user.id, visitorId });
  }

  @Public()
  @Get('catalog/products/:slug/related')
  @ApiZodResponse(RelatedProductsSchema, 200, 'Similar, bought together and also viewed.')
  related(@Param('slug') slug: string): Promise<RelatedProducts> {
    return this.recommendations.related(slug);
  }

  @OptionalAuth()
  @Get('recommendations')
  @ApiZodResponse(RecommendationsSchema, 200, 'Picks for this shopper, or popular products.')
  forShopper(
    @Query('visitorId') rawVisitorId: string | undefined,
    @Headers('x-cart-id') rawCartId: string | undefined,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<Recommendations> {
    // An invalid id is ignored rather than refused: the shopper still gets popular picks.
    const visitorId = OptionalVisitor.safeParse(rawVisitorId).data;
    const guestCart = OptionalCart.safeParse(rawCartId || undefined).data;
    const cart = user ? { userId: user.id } : guestCart ? { guestId: guestCart } : null;
    return this.recommendations.forShopper({ userId: user?.id, visitorId }, cart);
  }
}
