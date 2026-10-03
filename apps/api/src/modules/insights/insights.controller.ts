import {
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type ProductCopySuggestion,
  ProductCopySuggestionSchema,
  type ReviewInsights,
  ReviewInsightsSchema,
} from '@nixzora/validation';
import { ApiZodResponse } from '../../common/api-docs';
import { localeOr, requestLocale } from '../assistant/replies';
import { Public, RequirePermissions } from '../identity/guards/decorators';
import { ProductCopyService } from './product-copy.service';
import { ReviewInsightsService } from './review-insights.service';

@ApiTags('insights')
@Controller({ version: '1' })
export class InsightsController {
  constructor(
    private readonly insights: ReviewInsightsService,
    private readonly copy: ProductCopyService,
  ) {}

  /**
   * "What customers say" for a product page; null until it has 3 approved reviews. In the
   * reader's language: `?lang=` (for cached pages, so each language has its own URL), else
   * Accept-Language.
   */
  @Public()
  @Get('catalog/products/:slug/reviews/insights')
  @ApiQuery({ name: 'lang', required: false, enum: ['en', 'fr', 'es'] })
  @ApiZodResponse(ReviewInsightsSchema.nullable(), 200, 'Review summary, pros and cons.')
  async forProduct(
    @Param('slug') slug: string,
    @Query('lang') lang?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<{ insights: ReviewInsights | null }> {
    const locale = localeOr(lang, requestLocale(acceptLanguage));
    return { insights: await this.insights.forProduct(slug, locale) };
  }

  /** Rebuilds every product's insights (after enabling a model, or a bulk import). */
  @Post('admin/reviews/insights/refresh')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('reviews.moderate')
  refresh(): Promise<{ updated: number; scanned: number }> {
    return this.insights.refreshAll();
  }

  /** A draft description from the product's facts (p6-03). Staff edit it; nothing is saved. */
  @Post('admin/products/:id/copy-suggestion')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('catalog.write')
  @ApiZodResponse(ProductCopySuggestionSchema, 200, 'Draft description for staff to review.')
  suggestCopy(@Param('id', ParseUUIDPipe) id: string): Promise<ProductCopySuggestion> {
    return this.copy.suggest(id);
  }
}
