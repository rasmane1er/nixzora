import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type CategoryNode,
  type PagedResult,
  type ProductCard,
  type ProductDetail,
  ProductDetailSchema,
  type ProductListQuery,
  ProductListQuerySchema,
  type ProductLookup,
  type ProductLookupQuery,
  ProductLookupQuerySchema,
  SlugSchema,
} from '@nixzora/validation';
import { ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public } from '../identity/guards/decorators';
import { CatalogQueryService } from './catalog-query.service';

/** Storefront and mobile app catalog. Public: no sign-in needed to browse. */
@ApiTags('catalog')
@Public()
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(private readonly catalog: CatalogQueryService) {}

  @Get('categories')
  categories(): Promise<CategoryNode[]> {
    return this.catalog.categoryTree();
  }

  @Get('brands')
  brands() {
    return this.catalog.brands();
  }

  @Get('products')
  @ApiQuery({ name: 'q', required: false, example: 'laptop 32gb' })
  @ApiQuery({ name: 'category', required: false, example: 'laptops' })
  @ApiQuery({ name: 'brand', required: false, example: 'kestrel' })
  @ApiQuery({ name: 'minPrice', required: false, description: 'cents' })
  @ApiQuery({ name: 'maxPrice', required: false, description: 'cents' })
  @ApiQuery({ name: 'inStock', required: false, enum: ['true', 'false'] })
  @ApiQuery({
    name: 'sort',
    required: false,
    enum: ['relevance', 'price_asc', 'price_desc', 'newest'],
  })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'pageSize', required: false })
  products(
    @Query(new ZodValidationPipe(ProductListQuerySchema)) query: ProductListQuery,
  ): Promise<PagedResult<ProductCard>> {
    return this.catalog.listProducts(query);
  }

  /** For the app's barcode scanner: barcode, SKU or product link → product slug. */
  @Get('lookup')
  @ApiQuery({ name: 'code', example: '0840244703127' })
  lookup(
    @Query(new ZodValidationPipe(ProductLookupQuerySchema)) query: ProductLookupQuery,
  ): Promise<ProductLookup> {
    return this.catalog.lookup(query.code);
  }

  @Get('products/:slug')
  @ApiZodResponse(ProductDetailSchema)
  product(@Param('slug', new ZodValidationPipe(SlugSchema)) slug: string): Promise<ProductDetail> {
    return this.catalog.productBySlug(slug);
  }
}
