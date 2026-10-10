import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type SizeChartSave, SizeChartSaveSchema, type SizeChartView } from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { RequirePermissions } from '../identity/guards/decorators';
import { SizeChartsService } from './size-charts.service';

const uuid = new ParseUUIDPipe();
const body = new ZodValidationPipe(SizeChartSaveSchema);

/** A store's size charts (p10-26); it can also use NIXZORA's. */
@ApiTags('seller')
@ApiBearerAuth()
@Controller({ path: 'seller/size-charts', version: '1' })
export class SellerSizeChartsController {
  constructor(
    private readonly charts: SizeChartsService,
    private readonly prisma: PrismaService,
  ) {}

  private async sellerId(actor: ActorContext, write = false): Promise<string> {
    const member = await this.prisma.sellerMember.findUnique({
      where: { userId: actor.user.id },
      select: { sellerId: true, role: true },
    });
    if (!member) throw new ForbiddenException('Set up your seller account first.');
    if (write && !['OWNER', 'STAFF'].includes(member.role)) {
      throw new ForbiddenException('Your role can’t change size charts.');
    }
    return member.sellerId;
  }

  @Get()
  async list(@Actor() actor: ActorContext): Promise<SizeChartView[]> {
    return this.charts.list(await this.sellerId(actor));
  }

  @Post()
  @ApiZodBody(SizeChartSaveSchema)
  async create(
    @Body(body) input: SizeChartSave,
    @Actor() actor: ActorContext,
  ): Promise<SizeChartView> {
    return this.charts.create(await this.sellerId(actor, true), { ...input, isDefault: false });
  }

  @Put(':id')
  @ApiZodBody(SizeChartSaveSchema)
  async update(
    @Param('id', uuid) id: string,
    @Body(body) input: SizeChartSave,
    @Actor() actor: ActorContext,
  ): Promise<SizeChartView> {
    return this.charts.update(await this.sellerId(actor, true), id, { ...input, isDefault: false });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', uuid) id: string, @Actor() actor: ActorContext): Promise<void> {
    await this.charts.remove(await this.sellerId(actor, true), id);
  }
}

/** NIXZORA's size charts and each category's default (Ops Center). */
@ApiTags('admin')
@ApiBearerAuth()
@RequirePermissions('catalog.write')
@Controller({ path: 'admin/size-charts', version: '1' })
export class AdminSizeChartsController {
  constructor(private readonly charts: SizeChartsService) {}

  @Get()
  list(): Promise<SizeChartView[]> {
    return this.charts.list(null);
  }

  @Post()
  @ApiZodBody(SizeChartSaveSchema)
  create(@Body(body) input: SizeChartSave): Promise<SizeChartView> {
    return this.charts.create(null, input);
  }

  @Put(':id')
  @ApiZodBody(SizeChartSaveSchema)
  update(@Param('id', uuid) id: string, @Body(body) input: SizeChartSave): Promise<SizeChartView> {
    return this.charts.update(null, id, input);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id', uuid) id: string): Promise<void> {
    await this.charts.remove(null, id);
  }
}
