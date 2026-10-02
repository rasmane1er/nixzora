import { Body, Controller, Delete, HttpCode, HttpStatus, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type PushDeviceRegister,
  PushDeviceRegisterSchema,
  type PushDeviceRemove,
  PushDeviceRemoveSchema,
} from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, RequirePermissions } from '../identity/guards/decorators';

/** The mobile app registers its push token after sign-in and removes it on sign-out. */
@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me/devices', version: '1' })
export class DevicesController {
  constructor(private readonly prisma: PrismaService) {}

  /** Idempotent. A token that belonged to another account moves to this one (shared phone). */
  @Put()
  @HttpCode(HttpStatus.NO_CONTENT)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiZodBody(PushDeviceRegisterSchema)
  async register(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(PushDeviceRegisterSchema)) body: PushDeviceRegister,
  ): Promise<void> {
    const platform = body.platform === 'ios' ? 'IOS' : 'ANDROID';
    await this.prisma.pushDevice.upsert({
      where: { token: body.token },
      create: { userId: user.id, token: body.token, platform },
      update: { userId: user.id, platform, lastSeenAt: new Date() },
    });
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiZodBody(PushDeviceRemoveSchema)
  async remove(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(PushDeviceRemoveSchema)) body: PushDeviceRemove,
  ): Promise<void> {
    await this.prisma.pushDevice.deleteMany({ where: { token: body.token, userId: user.id } });
  }
}
