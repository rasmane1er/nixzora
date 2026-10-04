import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  type AdminUser,
  type CustomerNoteCreate,
  CustomerNoteCreateSchema,
  type CustomerNoteView,
  type PagedResult,
  type RoleGrant,
  RoleGrantSchema,
  type UserListQuery,
  UserListQuerySchema,
} from '@nixzora/validation';
import { ApiZodBody } from '../../common/api-docs';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { RequirePermissions } from '../identity/guards/decorators';
import { OpsSummaryService } from './ops-summary.service';
import { UsersAdminService } from './users-admin.service';

const uuid = new ParseUUIDPipe();

@ApiTags('admin · users')
@ApiBearerAuth()
@Controller({ path: 'admin', version: '1' })
export class UsersAdminController {
  constructor(
    private readonly users: UsersAdminService,
    private readonly summaryService: OpsSummaryService,
  ) {}

  /** Numbers for the Ops Center home screen. */
  @Get('summary')
  @RequirePermissions('admin.access')
  summary() {
    return this.summaryService.summary();
  }

  @Get('users')
  @RequirePermissions('users.read')
  list(
    @Query(new ZodValidationPipe(UserListQuerySchema)) query: UserListQuery,
  ): Promise<PagedResult<AdminUser>> {
    return this.users.list(query);
  }

  @Get('users/:id')
  @RequirePermissions('users.read')
  get(@Param('id', uuid) id: string): Promise<AdminUser> {
    return this.users.get(id);
  }

  @Post('users/:id/roles')
  @RequirePermissions('roles.manage')
  @ApiZodBody(RoleGrantSchema)
  grant(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(RoleGrantSchema)) body: RoleGrant,
    @Actor() actor: ActorContext,
  ): Promise<AdminUser> {
    return this.users.grantRole(id, body.roleKey, actor);
  }

  @Delete('users/:id/roles/:roleKey')
  @RequirePermissions('roles.manage')
  revoke(
    @Param('id', uuid) id: string,
    @Param('roleKey', new ZodValidationPipe(RoleGrantSchema.shape.roleKey)) roleKey: string,
    @Actor() actor: ActorContext,
  ): Promise<AdminUser> {
    return this.users.revokeRole(id, roleKey, actor);
  }

  @Post('users/:id/suspend')
  @RequirePermissions('users.manage')
  suspend(@Param('id', uuid) id: string, @Actor() actor: ActorContext): Promise<AdminUser> {
    return this.users.setStatus(id, 'SUSPENDED', actor);
  }

  @Post('users/:id/reactivate')
  @RequirePermissions('users.manage')
  reactivate(@Param('id', uuid) id: string, @Actor() actor: ActorContext): Promise<AdminUser> {
    return this.users.setStatus(id, 'ACTIVE', actor);
  }

  // ───── Customer support ─────

  @Get('users/:id/orders')
  @RequirePermissions('orders.read.all')
  orders(@Param('id', uuid) id: string) {
    return this.users.orders(id);
  }

  @Get('users/:id/notes')
  @RequirePermissions('customers.notes')
  notes(@Param('id', uuid) id: string): Promise<CustomerNoteView[]> {
    return this.users.notes(id);
  }

  @Post('users/:id/notes')
  @RequirePermissions('customers.notes')
  @ApiZodBody(CustomerNoteCreateSchema)
  addNote(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(CustomerNoteCreateSchema)) body: CustomerNoteCreate,
    @Actor() actor: ActorContext,
  ): Promise<CustomerNoteView> {
    return this.users.addNote(id, body.body, actor);
  }
}
