import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type ReferralClaim,
  ReferralClaimSchema,
  ReferralCodeSchema,
  type ReferralInvitePreview,
  type ReferralView,
} from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, Public } from '../identity/guards/decorators';
import { ReferralsService } from './referrals.service';

/** Refer a friend (p10-23). */
@ApiTags('account')
@Controller({ version: '1' })
export class ReferralsController {
  constructor(private readonly referrals: ReferralsService) {}

  /** The invite page before signing up. */
  @Public()
  @Get('referrals/:code')
  @Throttle(perMinute(30))
  preview(
    @Param('code', new ZodValidationPipe(ReferralCodeSchema)) code: string,
  ): Promise<ReferralInvitePreview> {
    return this.referrals.preview(code);
  }

  @ApiBearerAuth()
  @Get('me/referral')
  view(@CurrentUser() user: AuthUser): Promise<ReferralView> {
    return this.referrals.view(user.id);
  }

  /** The shopper's welcome code from an invite, if any (null otherwise). */
  @ApiBearerAuth()
  @Get('me/referral/welcome')
  async welcome(@CurrentUser() user: AuthUser): Promise<{ welcome: ReferralView['welcome'] }> {
    return { welcome: await this.referrals.welcome(user.id) };
  }

  /** A new account enters a friend's code. */
  @ApiBearerAuth()
  @Post('me/referral/claim')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(5))
  @ApiZodBody(ReferralClaimSchema)
  claim(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(ReferralClaimSchema)) body: ReferralClaim,
  ): Promise<ReferralView> {
    return this.referrals.claim(user.id, body.code);
  }
}
