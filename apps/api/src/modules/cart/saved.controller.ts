import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { type CartAndSaved, type SavedItem } from '@nixzora/validation';
import { perMinute } from '../../common/throttle-profiles';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser } from '../identity/guards/decorators';
import { SavedService } from './saved.service';

/** Saved for later (p10-21): signed-in customers set cart items aside and bring them back. */
@ApiTags('cart')
@ApiBearerAuth()
@Controller({ version: '1' })
export class SavedController {
  constructor(private readonly saved: SavedService) {}

  @Get('me/saved')
  list(@CurrentUser() user: AuthUser): Promise<SavedItem[]> {
    return this.saved.list(user.id);
  }

  /** Cart line → saved. */
  @Post('cart/items/:variantId/save')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(60))
  save(
    @CurrentUser() user: AuthUser,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
  ): Promise<CartAndSaved> {
    return this.saved.save(user.id, variantId);
  }

  /** Saved → cart. */
  @Post('me/saved/:variantId/cart')
  @HttpCode(HttpStatus.OK)
  @Throttle(perMinute(60))
  moveToCart(
    @CurrentUser() user: AuthUser,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
  ): Promise<CartAndSaved> {
    return this.saved.moveToCart(user.id, variantId);
  }

  @Delete('me/saved/:variantId')
  remove(
    @CurrentUser() user: AuthUser,
    @Param('variantId', new ParseUUIDPipe()) variantId: string,
  ): Promise<SavedItem[]> {
    return this.saved.remove(user.id, variantId);
  }
}
