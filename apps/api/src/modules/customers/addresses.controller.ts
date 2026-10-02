import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type AddressCreate,
  AddressCreateSchema,
  type AddressUpdate,
  AddressUpdateSchema,
  type SavedAddress,
} from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type Address } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, RequirePermissions } from '../identity/guards/decorators';

const MAX_ADDRESSES = 20;

function toSaved(address: Address): SavedAddress {
  return {
    id: address.id,
    label: address.label,
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2 ?? undefined,
    city: address.city,
    region: address.region as SavedAddress['region'],
    postalCode: address.postalCode,
    country: 'US',
    phone: address.phone ?? undefined,
    isDefaultShipping: address.isDefaultShipping,
  };
}

/** The signed-in customer's address book. Every query is scoped to their own user id. */
@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me/addresses', version: '1' })
export class AddressesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser): Promise<SavedAddress[]> {
    const rows = await this.prisma.address.findMany({
      where: { userId: user.id },
      orderBy: [{ isDefaultShipping: 'desc' }, { createdAt: 'asc' }],
    });
    return rows.map(toSaved);
  }

  @Post()
  @ApiZodBody(AddressCreateSchema)
  async create(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(AddressCreateSchema)) body: AddressCreate,
  ): Promise<SavedAddress> {
    const count = await this.prisma.address.count({ where: { userId: user.id } });
    if (count >= MAX_ADDRESSES)
      throw new BadRequestException(`You can save up to ${MAX_ADDRESSES} addresses.`);
    const makeDefault = body.isDefaultShipping || count === 0;
    const created = await this.prisma.$transaction(async (tx) => {
      if (makeDefault) {
        await tx.address.updateMany({
          where: { userId: user.id },
          data: { isDefaultShipping: false },
        });
      }
      return tx.address.create({
        data: {
          userId: user.id,
          label: body.label ?? null,
          fullName: body.fullName,
          line1: body.line1,
          line2: body.line2 ?? null,
          city: body.city,
          region: body.region,
          postalCode: body.postalCode,
          country: body.country,
          phone: body.phone ?? null,
          isDefaultShipping: makeDefault,
        },
      });
    });
    return toSaved(created);
  }

  @Patch(':id')
  @ApiZodBody(AddressUpdateSchema)
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body(new ZodValidationPipe(AddressUpdateSchema)) body: AddressUpdate,
  ): Promise<SavedAddress> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.address.findFirst({ where: { id, userId: user.id } });
      if (!existing) throw new NotFoundException('Address not found.');
      if (body.isDefaultShipping) {
        await tx.address.updateMany({
          where: { userId: user.id },
          data: { isDefaultShipping: false },
        });
      }
      return tx.address.update({
        where: { id },
        data: {
          ...body,
          line2: body.line2 === undefined ? undefined : (body.line2 ?? null),
          phone: body.phone === undefined ? undefined : (body.phone ?? null),
        },
      });
    });
    return toSaved(updated);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<void> {
    const deleted = await this.prisma.address.deleteMany({ where: { id, userId: user.id } });
    if (!deleted.count) throw new NotFoundException('Address not found.');
  }
}
