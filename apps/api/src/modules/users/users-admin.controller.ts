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
import { PrismaService } from '../../prisma/prisma.service';
import { Actor, type ActorContext } from '../identity/guards/actor.decorator';
import { RequirePermissions } from '../identity/guards/decorators';
import { AuditService } from '../audit/audit.service';
import { InventoryService } from '../inventory/inventory.service';
import { UsersAdminService } from './users-admin.service';

const uuid = new ParseUUIDPipe();

@ApiTags('admin · users')
@ApiBearerAuth()
@Controller({ path: 'admin', version: '1' })
export class UsersAdminController {
  constructor(
    private readonly users: UsersAdminService,
    private readonly prisma: PrismaService,
    private readonly inventory: InventoryService,
    private readonly audit: AuditService,
  ) {}

  /** Numbers for the Ops Center home screen. */
  @Get('summary')
  @RequirePermissions('admin.access')
  async summary() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 3600_000);
    const [products, customers, staff, lowStock, recent, toShip, sales] = await Promise.all([
      this.prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.count({ where: { roles: { some: { role: { key: 'customer' } } } } }),
      this.prisma.user.count({
        where: { roles: { some: { role: { key: { not: 'customer' } } } } },
      }),
      this.inventory.list({ lowStockThreshold: 5 }),
      this.prisma.auditLog.findMany({ orderBy: { id: 'desc' }, take: 8 }),
      this.prisma.order.count({ where: { status: { in: ['PAID', 'FULFILLING'] } } }),
      this.prisma.order.aggregate({
        where: { placedAt: { gte: weekAgo }, status: { notIn: ['PENDING_PAYMENT', 'CANCELLED'] } },
        _sum: { totalCents: true },
        _count: { _all: true },
      }),
    ]);
    return {
      products: Object.fromEntries(products.map((row) => [row.status, row._count._all])),
      customers,
      staff,
      lowStockCount: lowStock.length,
      ordersToShip: toShip,
      salesLast7Days: { cents: sales._sum.totalCents ?? 0, orders: sales._count._all },
      lowStock: lowStock.slice(0, 5),
      recentActivity: recent.map((row) => ({
        id: row.id.toString(),
        action: row.action,
        actorId: row.actorId,
        entityType: row.entityType,
        entityId: row.entityId,
        createdAt: row.createdAt.toISOString(),
      })),
    };
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
  async orders(@Param('id', uuid) id: string) {
    const rows = await this.prisma.order.findMany({
      where: { userId: id },
      include: { items: { select: { quantity: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    return rows.map((order) => ({
      id: order.id,
      number: order.number,
      status: order.status,
      totalCents: order.totalCents,
      refundedCents: order.refundedCents,
      currency: order.currency,
      itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
      createdAt: order.createdAt.toISOString(),
    }));
  }

  @Get('users/:id/notes')
  @RequirePermissions('customers.notes')
  async notes(@Param('id', uuid) id: string): Promise<CustomerNoteView[]> {
    const rows = await this.prisma.customerNote.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      authorEmail: row.authorEmail,
      createdAt: row.createdAt.toISOString(),
    }));
  }

  @Post('users/:id/notes')
  @RequirePermissions('customers.notes')
  @ApiZodBody(CustomerNoteCreateSchema)
  async addNote(
    @Param('id', uuid) id: string,
    @Body(new ZodValidationPipe(CustomerNoteCreateSchema)) body: CustomerNoteCreate,
    @Actor() actor: ActorContext,
  ): Promise<CustomerNoteView> {
    await this.users.get(id);
    const note = await this.prisma.customerNote.create({
      data: { userId: id, authorId: actor.user.id, authorEmail: actor.user.email, body: body.body },
    });
    await this.audit.record({
      action: 'customers.note.added',
      actorId: actor.user.id,
      entityType: 'user',
      entityId: id,
      meta: actor.meta,
    });
    return {
      id: note.id,
      body: note.body,
      authorEmail: note.authorEmail,
      createdAt: note.createdAt.toISOString(),
    };
  }
}
