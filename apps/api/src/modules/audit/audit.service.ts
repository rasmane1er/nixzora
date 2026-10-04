import { Injectable, Logger } from '@nestjs/common';
import { type ActorType, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { type RequestMeta } from '../../common/request-meta';
import { type ActorContext } from '../identity/guards/actor.decorator';

export type AuditEvent = {
  action: string;
  actorType?: ActorType;
  actorId?: string | null;
  entityType?: string;
  entityId?: string;
  meta?: RequestMeta;
  metadata?: Record<string, unknown>;
};

/**
 * Writes to the append-only audit_logs table.
 * Recording never throws: an audit failure is logged loudly but must not break the user's request.
 */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record(event: AuditEvent): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          action: event.action,
          actorType: event.actorType ?? (event.actorId ? 'USER' : 'SYSTEM'),
          actorId: event.actorId ?? null,
          entityType: event.entityType ?? null,
          entityId: event.entityId ?? null,
          ipAddress: event.meta?.ipAddress ?? null,
          userAgent: event.meta?.userAgent ?? null,
          metadata: (event.metadata ?? {}) as Prisma.InputJsonObject,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to write audit event ${event.action}: ${(error as Error).message}`);
    }
  }

  /**
   * Records what a signed-in person did to one entity. Staff actions are logged as ADMIN unless
   * the actor says otherwise (customers and sellers acting on their own things: USER).
   */
  recordFor(
    actor: ActorContext,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    return this.record({
      action,
      actorType: actor.actorType ?? 'ADMIN',
      actorId: actor.user.id,
      entityType,
      entityId,
      meta: actor.meta,
      metadata,
    });
  }
}
