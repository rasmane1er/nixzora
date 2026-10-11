import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type BuyReminderSet, BuyReminderSetSchema } from '@nixzora/validation';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, RequirePermissions } from '../identity/guards/decorators';
import { BuyRemindersService } from './buy-reminders.service';

/** A customer's "Remind me to buy" reminders (p10-36). */
@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me/buy-reminders', version: '1' })
export class BuyRemindersController {
  constructor(private readonly reminders: BuyRemindersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.reminders.list(user.id);
  }

  @Put(':productId')
  set(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @Body(new ZodValidationPipe(BuyReminderSetSchema)) body: BuyReminderSet,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reminders.set(user.id, productId, body.date);
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('productId', new ParseUUIDPipe()) productId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.reminders.remove(user.id, productId);
  }
}
