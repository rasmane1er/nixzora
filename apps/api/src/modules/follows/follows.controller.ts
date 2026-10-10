import { Body, Controller, Delete, Get, Param, Patch, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import {
  type FollowedStore,
  type FollowingFeed,
  type FollowStatus,
  type FollowUpdate,
  FollowUpdateSchema,
  SlugSchema,
} from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { perMinute } from '../../common/throttle-profiles';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, MaybeUser, OptionalAuth } from '../identity/guards/decorators';
import { FollowsService } from './follows.service';

/** Follow stores (p10-24). */
@ApiTags('account')
@Controller({ version: '1' })
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  /** Follower count, and whether you follow it (when signed in). */
  @OptionalAuth()
  @Get('catalog/sellers/:handle/follow')
  status(
    @Param('handle', new ZodValidationPipe(SlugSchema)) handle: string,
    @MaybeUser() user: AuthUser | undefined,
  ): Promise<FollowStatus> {
    return this.follows.status(user?.id ?? null, handle);
  }

  @ApiBearerAuth()
  @Get('me/follows')
  stores(@CurrentUser() user: AuthUser): Promise<FollowedStore[]> {
    return this.follows.stores(user.id);
  }

  @ApiBearerAuth()
  @Get('me/following')
  feed(@CurrentUser() user: AuthUser): Promise<FollowingFeed> {
    return this.follows.feed(user.id);
  }

  @ApiBearerAuth()
  @Put('me/follows/:handle')
  @Throttle(perMinute(30))
  follow(
    @CurrentUser() user: AuthUser,
    @Param('handle', new ZodValidationPipe(SlugSchema)) handle: string,
  ): Promise<FollowStatus> {
    return this.follows.follow(user.id, handle);
  }

  @ApiBearerAuth()
  @Delete('me/follows/:handle')
  unfollow(
    @CurrentUser() user: AuthUser,
    @Param('handle', new ZodValidationPipe(SlugSchema)) handle: string,
  ): Promise<FollowStatus> {
    return this.follows.unfollow(user.id, handle);
  }

  /** Deal notifications on or off for one store. */
  @ApiBearerAuth()
  @Patch('me/follows/:handle')
  @ApiZodBody(FollowUpdateSchema)
  update(
    @CurrentUser() user: AuthUser,
    @Param('handle', new ZodValidationPipe(SlugSchema)) handle: string,
    @Body(new ZodValidationPipe(FollowUpdateSchema)) body: FollowUpdate,
  ): Promise<FollowStatus> {
    return this.follows.setNotify(user.id, handle, body.notify);
  }
}
