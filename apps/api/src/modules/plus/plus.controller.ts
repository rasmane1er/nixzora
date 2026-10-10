import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AdminPlusOverview,
  type AdminPlusQuery,
  AdminPlusQuerySchema,
  type MyPlus,
  type PlusJoin,
  type PlusJoinResult,
  PlusJoinSchema,
  type PlusOffer,
  type PlusUpdate,
  PlusUpdateSchema,
} from '@nixzora/validation';
import { ReqMeta, type RequestMeta } from '../../common/request-meta';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { requestLocale } from '../assistant/replies';
import { type AuthUser } from '../identity/auth-user';
import {
  CurrentUser,
  MaybeUser,
  OptionalAuth,
  RequirePermissions,
} from '../identity/guards/decorators';
import { PlusService } from './plus.service';

/** NIXZORA Plus (p10-15): the offer, and the signed-in customer's membership. */
@ApiTags('plus')
@Controller({ version: '1' })
export class PlusController {
  constructor(private readonly plus: PlusService) {}

  @Get('plus')
  @OptionalAuth()
  offer(@MaybeUser() user: AuthUser | undefined): Promise<PlusOffer> {
    return this.plus.offer(user?.id);
  }

  @Get('me/plus')
  mine(@CurrentUser() user: AuthUser): Promise<MyPlus> {
    return this.plus.mine(user.id);
  }

  /** Starts the free trial, or (trial used before) charges the first period like a checkout. */
  @Post('me/plus')
  @Throttle(perMinute(5))
  join(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(PlusJoinSchema)) body: PlusJoin,
    @ReqMeta() meta: RequestMeta,
    @Headers('accept-language') acceptLanguage?: string,
  ): Promise<PlusJoinResult> {
    return this.plus.join(user, body, meta, requestLocale(acceptLanguage));
  }

  /** Plan (from the next renewal), card, or leaving at the end of the period. */
  @Patch('me/plus')
  update(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(PlusUpdateSchema)) body: PlusUpdate,
    @ReqMeta() meta: RequestMeta,
  ): Promise<MyPlus> {
    return this.plus.update(user.id, body, meta);
  }
}

@ApiTags('admin · plus')
@Controller({ path: 'admin/plus', version: '1' })
export class AdminPlusController {
  constructor(private readonly plus: PlusService) {}

  @Get()
  @RequirePermissions('support.manage')
  overview(
    @Query(new ZodValidationPipe(AdminPlusQuerySchema)) query: AdminPlusQuery,
  ): Promise<AdminPlusOverview> {
    return this.plus.overview(query);
  }

  @Post(':userId/end')
  @RequirePermissions('support.manage')
  async end(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() user: AuthUser,
    @ReqMeta() meta: RequestMeta,
  ): Promise<{ ended: true }> {
    await this.plus.endByStaff(userId, user, meta);
    return { ended: true };
  }
}
