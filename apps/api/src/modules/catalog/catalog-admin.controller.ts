import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type AdminProductListQuery,
  AdminProductListQuerySchema,
  type BrandCreate,
  BrandCreateSchema,
  type BrandUpdate,
  BrandUpdateSchema,
  type CategoryCreate,
  CategoryCreateSchema,
  type CategoryNode,
  type CategoryUpdate,
  CategoryUpdateSchema,
  type ProductCreate,
  ProductCreateSchema,
  type ProductDetail,
  ProductDetailSchema,
  type ProductImageAttach,
  ProductImageAttachSchema,
  type ProductUpdate,
  ProductUpdateSchema,
  type VariantCreate,
  VariantCreateSchema,
  type VariantUpdate,
  VariantUpdateSchema,
} from '@nixzora/validation';
import { ApiZodBody, ApiZodResponse } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { RequirePermissions } from '../identity/guards/decorators';
import { CatalogAdminService } from './catalog-admin.service';
import { CatalogQueryService } from './catalog-query.service';

const uuid = new ParseUUIDPipe();

/** Ops Center catalog management. Staff only: catalog.write plus two-step verification. */
@ApiTags('admin · catalog')
@ApiBearerAuth()
@RequirePermissions('catalog.write')
@Controller({ path: 'admin', version: '1' })
export class CatalogAdminController {
  constructor(
    private readonly admin: CatalogAdminService,
    private readonly query: CatalogQueryService,
  ) {}

  // Categories
  @Get('categories')
  categories(): Promise<CategoryNode[]> {
    return this.query.categoryTree(true);
  }

  @Post('categories')
  @ApiZodBody(CategoryCreateSchema)
  createCategory(
    @Body(new ZodValidationPipe(CategoryCreateSchema)) body: CategoryCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.admin.createCategory(body, actor);
  }

  @Patch('categories/:id')
  @ApiZodBody(CategoryUpdateSchema)
  updateCategory(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(CategoryUpdateSchema)) body: CategoryUpdate,
    @Actor() actor: ActorContext,
  ) {
    return this.admin.updateCategory(id, body, actor);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(@Param('id', uuid) id: string, @Actor() actor: ActorContext): Promise<void> {
    return this.admin.deleteCategory(id, actor);
  }

  // Brands
  @Get('brands')
  brands() {
    return this.query.brands();
  }

  @Post('brands')
  @ApiZodBody(BrandCreateSchema)
  createBrand(
    @Body(new ZodValidationPipe(BrandCreateSchema)) body: BrandCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.admin.createBrand(body, actor);
  }

  @Patch('brands/:id')
  @ApiZodBody(BrandUpdateSchema)
  updateBrand(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(BrandUpdateSchema)) body: BrandUpdate,
    @Actor() actor: ActorContext,
  ) {
    return this.admin.updateBrand(id, body, actor);
  }

  // Products
  @Get('products')
  products(
    @Query(new ZodValidationPipe(AdminProductListQuerySchema)) query: AdminProductListQuery,
  ) {
    return this.query.listProductsForAdmin(query);
  }

  @Get('products/:id')
  @ApiZodResponse(ProductDetailSchema)
  product(@Param('id', uuid) id: string): Promise<ProductDetail> {
    return this.query.productById(id);
  }

  @Post('products')
  @ApiZodBody(ProductCreateSchema)
  @ApiZodResponse(ProductDetailSchema, 201)
  createProduct(
    @Body(new ZodValidationPipe(ProductCreateSchema)) body: ProductCreate,
    @Actor() actor: ActorContext,
  ): Promise<ProductDetail> {
    return this.admin.createProduct(body, actor);
  }

  @Patch('products/:id')
  @ApiZodBody(ProductUpdateSchema)
  @ApiZodResponse(ProductDetailSchema)
  updateProduct(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ProductUpdateSchema)) body: ProductUpdate,
    @Actor() actor: ActorContext,
  ): Promise<ProductDetail> {
    return this.admin.updateProduct(id, body, actor);
  }

  @Post('products/:id/variants')
  @ApiZodBody(VariantCreateSchema)
  addVariant(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(VariantCreateSchema)) body: VariantCreate,
    @Actor() actor: ActorContext,
  ): Promise<ProductDetail> {
    return this.admin.addVariant(id, body, actor);
  }

  @Patch('variants/:id')
  @ApiZodBody(VariantUpdateSchema)
  updateVariant(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(VariantUpdateSchema)) body: VariantUpdate,
    @Actor() actor: ActorContext,
  ): Promise<ProductDetail> {
    return this.admin.updateVariant(id, body, actor);
  }

  @Post('products/:id/images')
  @ApiZodBody(ProductImageAttachSchema)
  attachImage(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(ProductImageAttachSchema)) body: ProductImageAttach,
    @Actor() actor: ActorContext,
  ): Promise<ProductDetail> {
    return this.admin.attachImage(id, body, actor);
  }

  @Delete('products/:id/images/:imageId')
  removeImage(
    @Param('id', uuid) id: string,
    @Param('imageId', uuid) imageId: string,
    @Actor() actor: ActorContext,
  ): Promise<ProductDetail> {
    return this.admin.removeImage(id, imageId, actor);
  }
}
