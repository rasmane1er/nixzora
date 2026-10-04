import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { runsBackgroundJobs } from '../../common/background-jobs';

export type OutboxHandler = (event: {
  id: string;
  type: string;
  aggregateId: string;
  payload: Record<string, unknown>;
}) => Promise<void>;

const POLL_MS = 3_000;
const BATCH = 20;
const MAX_ATTEMPTS = 10;
/** When the outbox was last drained, for the health check (any process that drains sets it). */
const LAST_DRAIN_KEY = 'outbox:last-drain';

export type OutboxStats = { backlog: number; failed: number; lastRunAt?: string };

/**
 * Delivers transactional-outbox events to in-process handlers: emails, push, search indexing,
 * review insights. It runs in the notifications worker (ADR-0017), or in the API when
 * BACKGROUND_JOBS is on. Rows are claimed with FOR UPDATE SKIP LOCKED, so several processes can
 * drain at once without sending anything twice. Failures retry, up to 10 times.
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
    private readonly redis: RedisService,
  ) {}

  /** Event types something in this process delivers (the rest are only streamed). */
  handledTypes(): string[] {
    return [...this.handlers.keys()];
  }

  on(type: string, handler: OutboxHandler): void {
    this.handlers.set(type, [...(this.handlers.get(type) ?? []), handler]);
  }

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config)) return;
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
      await this.redis.client
        .set(LAST_DRAIN_KEY, new Date().toISOString(), 'EX', 3600)
        .catch(() => undefined);
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

  /** Waiting and given-up events, and when the outbox was last drained. */
  async stats(): Promise<OutboxStats> {
    // Only events something listens to here; every type is also streamed to Kafka (ADR-0020).
    const type = { in: [...this.handlers.keys()] };
    const [backlog, failed, lastRunAt] = await Promise.all([
      this.prisma.outboxEvent.count({
        where: { type, publishedAt: null, attempts: { lt: MAX_ATTEMPTS } },
      }),
      this.prisma.outboxEvent.count({
        where: { type, publishedAt: null, attempts: { gte: MAX_ATTEMPTS } },
      }),
      this.redis.client.get(LAST_DRAIN_KEY).catch(() => null),
    ]);
    return { backlog, failed, lastRunAt: lastRunAt ?? undefined };
  }
}
