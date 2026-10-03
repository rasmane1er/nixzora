import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type ProductViewEvent,
  ProductViewEventSchema,
  type Recommendations,
  RecommendationsSchema,
  type RelatedProducts,
  RelatedProductsSchema,
  VisitorIdSchema,
} from '@nixzora/validation';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { MaybeUser, OptionalAuth, Public } from '../identity/guards/decorators';
import { RecommendationsService } from './recommendations.service';

const OptionalVisitor = VisitorIdSchema.optional();

@ApiTags('recommendations')
@Controller({ version: '1' })
export class RecommendationsController {
  constructor(private readonly recommendations: RecommendationsService) {}

  /** A shopper opened a product page (p6-08). Guests send their random visitor id. */
  @OptionalAuth()
  @Post('events/views')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @ApiZodBody(ProductViewEventSchema)
  async view(
    @Body(new ZodValidationPipe(ProductViewEventSchema)) body: ProductViewEvent,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<void> {
    await this.recommendations.recordView(body.productId, {
      userId: user?.id,
      visitorId: body.visitorId,
    });
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
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<Recommendations> {
    // An invalid id is ignored rather than refused: the shopper still gets popular picks.
    const visitorId = OptionalVisitor.safeParse(rawVisitorId).data;
    return this.recommendations.forShopper({ userId: user?.id, visitorId });
  }
}
