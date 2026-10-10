import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type PriceHistory, PriceHistoryQuerySchema, SlugSchema } from '@nixzora/validation';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, Public } from '../identity/guards/decorators';
import { PriceHistoryService } from './price-history.service';

/** Price history on product pages, and the customer's browsing history (p10-19). */
@ApiTags('catalog')
@Controller({ version: '1' })
export class PriceHistoryController {
  constructor(private readonly history: PriceHistoryService) {}

  @Public()
  @Get('catalog/products/:slug/price-history')
  prices(
    @Param('slug', new ZodValidationPipe(SlugSchema)) slug: string,
    @Query(new ZodValidationPipe(PriceHistoryQuerySchema)) query: { days: number },
  ): Promise<PriceHistory> {
    return this.history.history(slug, query.days);
  }

  @Get('me/history')
  browsing(@CurrentUser() user: AuthUser) {
    return this.history.browsing(user.id);
  }

  /** Take one product out of the history (all of it: DELETE /me/shopping-history). */
  @Delete('me/history/:productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forget(
    @CurrentUser() user: AuthUser,
    @Param('productId', new ParseUUIDPipe()) productId: string,
  ): Promise<void> {
    await this.history.forget(user.id, productId);
  }
}
