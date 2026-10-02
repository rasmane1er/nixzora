import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { PageQuerySchema, type Page } from '@nixzora/validation';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/zod-validation.pipe';
import { PrismaService } from '../../prisma/prisma.service';
import { RequirePermissions } from '../identity/guards/decorators';

const AuditQuerySchema = PageQuerySchema.extend({
  action: z.string().max(100).optional(),
  actorId: z.uuid().optional(),
});
type AuditQuery = z.infer<typeof AuditQuerySchema>;

type AuditEntry = {
  id: string;
  action: string;
  actorType: string;
  actorId: string | null;
  entityType: string | null;
  entityId: string | null;
  ipAddress: string | null;
  metadata: unknown;
  createdAt: string;
};

@ApiTags('admin')
@ApiBearerAuth()
@Controller({ path: 'admin/audit-logs', version: '1' })
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('audit.read')
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'cursor', required: false, description: 'nextCursor from the previous page' })
  @ApiQuery({ name: 'action', required: false, example: 'auth.login.failed' })
  @ApiQuery({ name: 'actorId', required: false })
  async list(
    @Query(new ZodValidationPipe(AuditQuerySchema)) query: AuditQuery,
  ): Promise<Page<AuditEntry>> {
    const rows = await this.prisma.auditLog.findMany({
      where: {
        action: query.action,
        actorId: query.actorId,
        ...(query.cursor && /^\d+$/.test(query.cursor) ? { id: { lt: BigInt(query.cursor) } } : {}),
      },
      orderBy: { id: 'desc' },
      take: query.limit + 1,
    });

    const page = rows.slice(0, query.limit);
    return {
      items: page.map((row) => ({
        id: row.id.toString(),
        action: row.action,
        actorType: row.actorType,
        actorId: row.actorId,
        entityType: row.entityType,
        entityId: row.entityId,
        ipAddress: row.ipAddress,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id.toString() ?? null) : null,
    };
  }
}
