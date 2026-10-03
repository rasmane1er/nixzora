import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { type PublicSeller, PublicSellerSchema, SlugSchema } from '@nixzora/validation';
import { ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public } from '../identity/guards/decorators';
import { SellersService } from './sellers.service';

/** Public store pages. Products come from GET /catalog/products?seller=<handle>. */
@ApiTags('catalog')
@Controller({ path: 'catalog/sellers', version: '1' })
export class SellersPublicController {
  constructor(private readonly sellers: SellersService) {}

  @Public()
  @Get(':handle')
  @ApiZodResponse(PublicSellerSchema)
  get(@Param('handle', new ZodValidationPipe(SlugSchema)) handle: string): Promise<PublicSeller> {
    return this.sellers.publicProfile(handle);
  }
}
