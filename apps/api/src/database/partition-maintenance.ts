import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runsBackgroundJobs } from '../common/background-jobs';
import { type Env } from '../config/env';
import { KafkaService } from '../kafka/kafka.service';
import { OutboxService } from '../modules/outbox/outbox.service';
import { EVENT_RETENTION_DAYS } from '../modules/recommendations/recommendations.service';
import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;
/** Partitions are created this many months ahead, so inserts never land in the default one. */
const MONTHS_AHEAD = 3;
/** Delivered outbox events are kept this long (for support and replays), then dropped by month. */
const OUTBOX_RETENTION_MONTHS = 3;
/** Same attempt limit as OutboxService: events past it are given up on. */
const OUTBOX_MAX_ATTEMPTS = 10;

export type MaintenanceResult = { created: number; dropped: Record<string, number> };

/**
 * Keeps the monthly partitions of the event tables (ADR-0022): creates the next months ahead of
 * time, and drops whole months past their retention instead of deleting rows one by one.
 *
 * - product_events: 6 months (the recommendations' window, EVENT_RETENTION_DAYS).
 * - outbox_events: 3 months, and never a month that still holds an event waiting for delivery
 *   (to a handler here, or to Kafka when streaming is on).
 * - audit_logs: kept, unless AUDIT_RETENTION_MONTHS is set (the log is append-only).
 *
 * Runs at start-up and daily, where background jobs run (the notifications worker).
 */
@Injectable()
export class PartitionMaintenance implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(PartitionMaintenance.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
    private readonly kafka: KafkaService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onApplicationBootstrap(): void {
    if (!runsBackgroundJobs(this.config)) return;
    const run = () =>
      void this.run().catch((error: Error) =>
        this.logger.error(`Partition maintenance failed: ${error.message}`),
      );
    run();
    this.timer = setInterval(run, DAY_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<MaintenanceResult> {
    let created = 0;
    for (const table of ['audit_logs', 'product_events', 'outbox_events']) {
      const [row] = await this.prisma.$queryRaw<{ n: number }[]>`
        SELECT partitions.ensure_monthly(${table}::regclass, now()::date, ${MONTHS_AHEAD}::int) AS n`;
      created += Number(row?.n ?? 0);
    }

    const dropped: Record<string, number> = {};
    dropped.product_events = await this.drop(
      'product_events',
      Math.ceil(EVENT_RETENTION_DAYS / 30),
      null,
    );
    dropped.outbox_events = await this.drop(
      'outbox_events',
      OUTBOX_RETENTION_MONTHS,
      this.undeliveredOutbox(),
    );
    const auditMonths = this.config.get('AUDIT_RETENTION_MONTHS', { infer: true });
    if (auditMonths) dropped.audit_logs = await this.drop('audit_logs', auditMonths, null);

    if (created || Object.values(dropped).some(Boolean)) {
      this.logger.log(`Partitions: ${created} created, dropped ${JSON.stringify(dropped)}`);
    }
    return { created, dropped };
  }

  /** SQL condition for "this month still has events to deliver": a partition with one is kept. */
  undeliveredOutbox(): string {
    const handled = this.outbox.handledTypes();
    const conditions: string[] = [];
    if (handled.length) {
      const list = handled.map((type) => `'${type.replace(/'/g, "''")}'`).join(', ');
      conditions.push(
        `(published_at IS NULL AND attempts < ${OUTBOX_MAX_ATTEMPTS} AND type IN (${list}))`,
      );
    }
    if (this.kafka.enabled) conditions.push('streamed_at IS NULL');
    return conditions.length ? conditions.join(' OR ') : 'false';
  }

  private async drop(table: string, keepMonths: number, blockedWhere: string | null) {
    const [row] = await this.prisma.$queryRaw<{ n: number }[]>`
      SELECT partitions.drop_older_than(${table}::regclass, ${keepMonths}::int, ${blockedWhere}::text) AS n`;
    return Number(row?.n ?? 0);
  }
}
