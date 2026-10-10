import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type VisualSearchRequest,
  VisualSearchRequestSchema,
  type VisualSearchResult,
} from '@nixzora/validation';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public } from '../identity/guards/decorators';
import { VisualSearchService } from './visual-search.service';

/** Search by photo (p10-14). Public, like the rest of the catalog. */
@ApiTags('catalog')
@Public()
@Controller({ path: 'catalog/visual-search', version: '1' })
export class VisualSearchController {
  constructor(private readonly visual: VisualSearchService) {}

  /** A photo (base64) → similar products. The photo is read and forgotten, never stored. */
  @Post()
  @HttpCode(200)
  @Throttle(perMinute(10))
  search(
    @Body(new ZodValidationPipe(VisualSearchRequestSchema)) body: VisualSearchRequest,
  ): Promise<VisualSearchResult> {
    return this.visual.search(Buffer.from(body.image, 'base64'));
  }

  /**
   * The same, with the photo as the raw body (Content-Type image/jpeg, png, webp or avif, up to
   * 10 MB): the app sends the picked file as it is, without decoding it in JavaScript.
   */
  @Post('upload')
  @HttpCode(200)
  @Throttle(perMinute(10))
  @ApiConsumes('image/jpeg', 'image/png', 'image/webp', 'image/avif')
  upload(@Body() body: unknown): Promise<VisualSearchResult> {
    if (!Buffer.isBuffer(body) || body.length === 0) {
      throw new BadRequestException('Send the photo as image/jpeg, image/png or image/webp.');
    }
    return this.visual.search(body);
  }

  /** The same result again for 30 minutes (the storefront renders it on a page). */
  @Get(':id')
  result(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<VisualSearchResult> {
    return this.visual.result(id);
  }
}
