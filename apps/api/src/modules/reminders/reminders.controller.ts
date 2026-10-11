import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { type AuthUser } from '../identity/auth-user';
import { CurrentUser, RequirePermissions } from '../identity/guards/decorators';
import { RemindersService } from './reminders.service';

/** A customer's warranties (p10-33). */
@ApiTags('account')
@ApiBearerAuth()
@RequirePermissions('account.manage.own')
@Controller({ path: 'me/warranties', version: '1' })
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.reminders.warranties(user.id);
  }
}
