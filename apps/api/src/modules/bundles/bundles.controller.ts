import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type BundleCreate, BundleCreateSchema, SlugSchema } from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { Public, RequirePermissions } from '../identity/guards/decorators';
import { BundlesService } from './bundles.service';

const uuid = new ParseUUIDPipe();

/** The bundles a product is in, for its page (p10-16). */
@ApiTags('catalog')
@Public()
@Controller({ path: 'catalog/products', version: '1' })
export class BundlesController {
  constructor(private readonly bundles: BundlesService) {}

  @Get(':slug/bundles')
  forProduct(@Param('slug', new ZodValidationPipe(SlugSchema)) slug: string) {
    return this.bundles.forProduct(slug);
  }
}

/** A store's bundles of its own listings. */
@ApiTags('seller')
@ApiBearerAuth()
@Controller({ path: 'seller/bundles', version: '1' })
export class SellerBundlesController {
  constructor(
    private readonly bundles: BundlesService,
    private readonly prisma: PrismaService,
  ) {}

  private async sellerId(actor: ActorContext): Promise<string> {
    const member = await this.prisma.sellerMember.findUnique({
      where: { userId: actor.user.id },
      select: { sellerId: true, seller: { select: { status: true } } },
    });
    if (!member) throw new ForbiddenException('Set up your seller account first.');
    if (member.seller.status !== 'ACTIVE') {
      throw new ForbiddenException('Your store needs to be approved before it can sell bundles.');
    }
    return member.sellerId;
  }

  @Get()
  async list(@Actor() actor: ActorContext) {
    return this.bundles.list(await this.sellerId(actor));
  }

  @Post()
  @ApiZodBody(BundleCreateSchema)
  async create(
    @Body(new ZodValidationPipe(BundleCreateSchema)) body: BundleCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.bundles.create(body, actor, await this.sellerId(actor));
  }

  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  async archive(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.bundles.archive(id, actor, await this.sellerId(actor));
  }
}

/** Ops Center: every bundle; NIXZORA's own are made here. */
@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('promotions.manage')
@Controller({ path: 'admin/bundles', version: '1' })
export class BundlesAdminController {
  constructor(private readonly bundles: BundlesService) {}

  @Get()
  list() {
    return this.bundles.list(undefined);
  }

  @Post()
  @ApiZodBody(BundleCreateSchema)
  create(
    @Body(new ZodValidationPipe(BundleCreateSchema)) body: BundleCreate,
    @Actor() actor: ActorContext,
  ) {
    return this.bundles.create(body, actor, null);
  }

  /** Staff can retire any bundle, a store's included. */
  @Post(':id/archive')
  @HttpCode(HttpStatus.OK)
  archive(@Param('id', uuid) id: string, @Actor() actor: ActorContext) {
    return this.bundles.archive(id, actor, null);
  }
}
