import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';

export type OutboxHandler = (event: {
  id: string;
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}) => Promise<void>;

const POLL_MS = 3_000;
const BATCH = 20;
const MAX_ATTEMPTS = 10;

/**
 * Delivers transactional-outbox events to in-process handlers (emails today; a message
 * broker in Phase 8). Rows are claimed with FOR UPDATE SKIP LOCKED, so several API
 * instances can run the worker without sending anything twice. Failures retry, up to 10 times.
 */
@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxService.name);
  private readonly handlers = new Map<string, OutboxHandler[]>();
  private timer?: NodeJS.Timeout;
  private draining = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  on(type: string, handler: OutboxHandler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    this.timer = setInterval(() => void this.drain(), POLL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Processes everything currently pending. Tests call this directly. */
  async drain(): Promise<number> {
    if (this.draining) return 0;
    this.draining = true;
    let processed = 0;
    try {
      for (;;) {
        const done = await this.batch();
        processed += done;
        if (done < BATCH) break;
      }
    } catch (error) {
      this.logger.error(`Outbox drain failed: ${(error as Error).message}`);
    } finally {
      this.draining = false;
    }
    return processed;
  }

  private async batch(): Promise<number> {
    const types = [...this.handlers.keys()];
    if (!types.length) return 0;
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<
          { id: string; type: string; aggregate_id: string; payload: Record<string, unknown> }[]
        >`
          SELECT id::text, type, aggregate_id, payload
          FROM outbox_events
          WHERE published_at IS NULL AND attempts < ${MAX_ATTEMPTS} AND type = ANY(${types}::text[])
          ORDER BY created_at
          LIMIT ${BATCH}
          FOR UPDATE SKIP LOCKED`;
        for (const row of rows) {
          try {
            for (const handler of this.handlers.get(row.type) ?? []) {
              await handler({
                id: row.id,
                type: row.type,
                aggregateId: row.aggregate_id,
                payload: row.payload,
              });
            }
            await tx.outboxEvent.update({
              where: { id: row.id },
              data: { publishedAt: new Date(), attempts: { increment: 1 }, lastError: null },
            });
          } catch (error) {
            const message = (error as Error).message.slice(0, 500);
            this.logger.warn(`Outbox event ${row.type} ${row.id} failed: ${message}`);
            await tx.outboxEvent.update({
              where: { id: row.id },
              data: { attempts: { increment: 1 }, lastError: message },
            });
          }
        }
        return rows.length;
      },
      { timeout: 60_000 },
    );
  }
}
