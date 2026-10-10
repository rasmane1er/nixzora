import { Controller, Get, Headers, Param, Query } from '@nestjs/common';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import {
  type CategoryNode,
  type Facet,
  type ProductPage,
  type SearchSuggestions,
  type ProductDetail,
  ProductDetailSchema,
  type ProductListQuery,
  ProductListQuerySchema,
  type ProductLookup,
  type ProductLookupQuery,
  ProductLookupQuerySchema,
  SlugSchema,
  type CompareQuery,
  CompareQuerySchema,
  type CompareView,
} from '@nixzora/validation';
import { ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Public } from '../identity/guards/decorators';
import { requestLocale } from '../assistant/replies';
import { CatalogQueryService } from './catalog-query.service';
import { SearchHelpService } from './search-help.service';

/** Storefront and mobile app catalog. Public: no sign-in needed to browse. */
@ApiTags('catalog')
@Public()
@Controller({ path: 'catalog', version: '1' })
export class CatalogController {
  constructor(
    private readonly catalog: CatalogQueryService,
    private readonly help: SearchHelpService,
  ) {}

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
  @ApiQuery({ name: 'f', required: false, example: 'ram_gb:32', isArray: true })
  products(
    @Query(new ZodValidationPipe(ProductListQuerySchema)) query: ProductListQuery,
  ): Promise<ProductPage> {
    return this.catalog.listProducts(query);
  }

  /** Spec and option filters for a search, category, brand or store, with counts. */
  @Get('facets')
  async facets(
    @Query(new ZodValidationPipe(ProductListQuerySchema)) query: ProductListQuery,
  ): Promise<{ facets: Facet[] }> {
    return { facets: await this.catalog.facets(query) };
  }

  /** What the search box offers while the shopper types. */
  @Get('suggest')
  @ApiQuery({ name: 'q', example: 'head' })
  suggest(
    @Query('q') q: string | undefined,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<SearchSuggestions> {
    return this.help.suggest(String(q ?? '').slice(0, 200), requestLocale(acceptLanguage));
  }

  /** For the app's barcode scanner: barcode, SKU or product link → product slug. */
  @Get('lookup')
  @ApiQuery({ name: 'code', example: '0840244703127' })
  lookup(
    @Query(new ZodValidationPipe(ProductLookupQuerySchema)) query: ProductLookupQuery,
  ): Promise<ProductLookup> {
    return this.catalog.lookup(query.code);
  }

  /** Compare (p10-13): /catalog/compare?products=slug,slug (up to 4). */
  @Get('compare')
  compare(
    @Query(new ZodValidationPipe(CompareQuerySchema)) query: CompareQuery,
  ): Promise<CompareView> {
    return this.catalog.compare(query.products);
  }

  @Get('products/:slug')
  @ApiZodResponse(ProductDetailSchema)
  product(@Param('slug', new ZodValidationPipe(SlugSchema)) slug: string): Promise<ProductDetail> {
    return this.catalog.productBySlug(slug);
  }
}
