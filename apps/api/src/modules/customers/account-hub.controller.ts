import { Body, Controller, Get, Header, Patch, Put, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type AccountOrderQuery,
  AccountOrderQuerySchema,
  type AccountPreferences,
  AccountPreferencesSchema,
  type ProfileUpdate,
  ProfileUpdateSchema,
  type ReturnView,
} from '@nixzora/validation';
import { type Response } from 'express';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, RequirePermissions } from '../identity/guards/decorators';
import { ReturnsService } from '../orders/returns.service';
import { AccountHubService } from './account-hub.service';

/** "Your Account": everything a signed-in customer can see and do about their own account. */
@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me', version: '1' })
export class AccountHubController {
  constructor(
    private readonly hub: AccountHubService,
    private readonly returnsService: ReturnsService,
  ) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthUser) {
    return this.hub.overview(user.id);
  }

  @Get('profile')
  profile(@CurrentUser() user: AuthUser) {
    return this.hub.profile(user.id);
  }

  @Patch('profile')
  @ApiZodBody(ProfileUpdateSchema)
  updateProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ProfileUpdateSchema)) body: ProfileUpdate,
  ) {
    return this.hub.updateProfile(user.id, body);
  }

  @Get('order-history')
  @RequirePermissions('orders.read.own')
  orders(
    @CurrentUser() user: AuthUser,
    @Query(new ZodValidationPipe(AccountOrderQuerySchema)) query: AccountOrderQuery,
  ) {
    return this.hub.orders(user.id, query);
  }

  @Get('buy-again')
  @RequirePermissions('orders.read.own')
  buyAgain(@CurrentUser() user: AuthUser) {
    return this.hub.buyAgain(user.id);
  }

  @Get('returns')
  @RequirePermissions('orders.read.own')
  returns(@CurrentUser() user: AuthUser): Promise<ReturnView[]> {
    return this.returnsService.forUser(user.id);
  }

  @Get('reviews')
  reviews(@CurrentUser() user: AuthUser) {
    return this.hub.reviews(user.id);
  }

  @Get('preferences')
  preferences(@CurrentUser() user: AuthUser) {
    return this.hub.preferences(user.id);
  }

  @Put('preferences')
  @ApiZodBody(AccountPreferencesSchema)
  updatePreferences(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(AccountPreferencesSchema)) body: AccountPreferences,
  ) {
    return this.hub.updatePreferences(user.id, body);
  }

  /** A copy of the customer's data as a JSON file (a few downloads per hour). */
  @Get('export')
  @Throttle({ default: { limit: 5, ttl: 3_600_000 } })
  @Header('Cache-Control', 'no-store')
  async export(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="nixzora-account-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    return this.hub.export(user.id);
  }
}
