import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { type Env } from '../../config/env';
import { KafkaService } from '../../kafka/kafka.service';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';

const POLL_MS = 1_000;
const BATCH = 200;
/** When events last reached Kafka, for the health check. */
const LAST_STREAM_KEY = 'outbox:last-stream';

/** The JSON value of every message: the outbox row, as other services read it. */
export type StreamedEvent = {
  id: string;
  type: string;
  aggregateType: string;
  aggregateId: string;
  occurredAt: string;
  payload: unknown;
};

export type StreamStats = { enabled: boolean; backlog: number; lastRunAt?: string };

type Row = {
  id: string;
  type: string;
  aggregate_type: string;
  aggregate_id: string;
  payload: unknown;
  created_at: Date;
};

/**
 * Streams every outbox event to Kafka (ADR-0020): one topic per aggregate
 * ("nixzora.order.events"), keyed by the aggregate id so each order's events stay in order.
 * Rows are claimed with FOR UPDATE SKIP LOCKED and marked only after Kafka acknowledged them, so
 * delivery is at least once; consumers skip duplicates by the event id. Runs where background
 * jobs run (the notifications worker), and only with KAFKA_BROKERS set.
 */
@Injectable()
export class OutboxStreamer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxStreamer.name);
  private timer?: NodeJS.Timeout;
  private streaming = false;
  private failures = 0;
  private nextAttemptAt = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly kafka: KafkaService,
    private readonly redis: RedisService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (!this.kafka.enabled || !runsBackgroundJobs(this.config)) return;
    this.timer = setInterval(() => void this.tick(), POLL_MS);
    this.timer.unref();
    this.logger.log('Streaming outbox events to Kafka');
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Backs off (up to a minute) while Kafka is unreachable, instead of logging every second. */
  private async tick(): Promise<void> {
    if (Date.now() < this.nextAttemptAt) return;
    try {
      await this.stream();
      this.failures = 0;
    } catch (error) {
      this.failures += 1;
      const waitMs = Math.min(60_000, 1_000 * 2 ** this.failures);
      this.nextAttemptAt = Date.now() + waitMs;
      this.logger.warn(
        `Streaming to Kafka failed (retrying in ${waitMs / 1000}s): ${(error as Error).message}`,
      );
    }
  }

  /** Sends everything waiting; returns how many events went out. Tests call this directly. */
  async stream(): Promise<number> {
    if (!this.kafka.enabled || this.streaming) return 0;
    this.streaming = true;
    let sent = 0;
    try {
      for (;;) {
        const done = await this.batch();
        sent += done;
        if (done < BATCH) break;
      }
      await this.redis.client
        .set(LAST_STREAM_KEY, new Date().toISOString(), 'EX', 3600)
        .catch(() => undefined);
    } finally {
      this.streaming = false;
    }
    return sent;
  }

  private batch(): Promise<number> {
    return this.prisma.$transaction(
      async (tx) => {
        const rows = await tx.$queryRaw<Row[]>`
          SELECT id::text, type, aggregate_type, aggregate_id, payload, created_at
          FROM outbox_events
          WHERE streamed_at IS NULL
          ORDER BY created_at
          LIMIT ${BATCH}
          FOR UPDATE SKIP LOCKED`;
        if (!rows.length) return 0;
        await this.kafka.publish(
          rows.map((row) => {
            const event: StreamedEvent = {
              id: row.id,
              type: row.type,
              aggregateType: row.aggregate_type,
              aggregateId: row.aggregate_id,
              occurredAt: row.created_at.toISOString(),
              payload: row.payload,
            };
            return {
              topic: this.kafka.topicFor(row.aggregate_type),
              key: row.aggregate_id,
              value: JSON.stringify(event),
              headers: {
                'event-id': row.id,
                'event-type': row.type,
                'content-type': 'application/json',
              },
            };
          }),
        );
        await tx.outboxEvent.updateMany({
          where: { id: { in: rows.map((row) => row.id) } },
          data: { streamedAt: new Date() },
        });
        return rows.length;
      },
      { timeout: 60_000 },
    );
  }

  async stats(): Promise<StreamStats> {
    if (!this.kafka.enabled) return { enabled: false, backlog: 0 };
    const [backlog, lastRunAt] = await Promise.all([
      this.prisma.outboxEvent.count({ where: { streamedAt: null } }),
      this.redis.client.get(LAST_STREAM_KEY).catch(() => null),
    ]);
    return { enabled: true, backlog, lastRunAt: lastRunAt ?? undefined };
  }
}
