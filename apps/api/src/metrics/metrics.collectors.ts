import { Injectable, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { runsBackgroundJobs } from '../common/background-jobs';
import { type Env } from '../config/env';
import { OutboxStreamer } from '../modules/outbox/outbox-streamer';
import { OutboxService } from '../modules/outbox/outbox.service';
import { ReadDatabase } from '../prisma/read-database';
import {
  businessEvents,
  outboxBacklog,
  outboxFailed,
  outboxLastRun,
  replicaLag,
  replicaUsable,
  scrapeHooks,
} from './metrics';

/** Order, return and fraud-review events counted for the business dashboard (where the worker delivers them). */
const BUSINESS_EVENTS = [
  'order.paid',
  'order.shipped',
  'order.delivered',
  'order.cancelled',
  'order.refunded',
  'return.requested',
  'seller.order.created',
  // Fraud signals (ADR-0024)
  'risk.checkout_declined',
  'risk.review_opened',
];

/**
 * Fills the scrape-time gauges of the API image's processes: outbox and Kafka backlogs, the read
 * replica's lag, and business event counters.
 */
@Injectable()
export class MetricsCollectors implements OnModuleInit {
  constructor(
    private readonly outbox: OutboxService,
    private readonly streamer: OutboxStreamer,
    private readonly read: ReadDatabase,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    for (const type of BUSINESS_EVENTS) {
      this.outbox.on(type, async () => {
        businessEvents.inc({ type });
      });
    }

    // Only the process that runs the jobs reports the queues (the API would double-count).
    if (runsBackgroundJobs(this.config)) {
      scrapeHooks.queues = async () => {
        const [stats, stream] = await Promise.all([this.outbox.stats(), this.streamer.stats()]);
        outboxBacklog.reset();
        outboxBacklog.set({ queue: 'deliver' }, stats.backlog);
        if (stream.enabled) outboxBacklog.set({ queue: 'stream' }, stream.backlog);
        outboxFailed.set(stats.failed);
        outboxLastRun.reset();
        if (stats.lastRunAt) {
          outboxLastRun.set({ queue: 'deliver' }, Date.parse(stats.lastRunAt) / 1000);
        }
        if (stream.lastRunAt) {
          outboxLastRun.set({ queue: 'stream' }, Date.parse(stream.lastRunAt) / 1000);
        }
      };
    }

    scrapeHooks.replica = () => {
      const status = this.read.status();
      replicaLag.reset();
      replicaUsable.reset();
      if (!status.configured) return;
      if (status.lagSeconds !== undefined) replicaLag.set({ replica: 'read' }, status.lagSeconds);
      replicaUsable.set({ replica: 'read' }, status.usable ? 1 : 0);
    };
  }
}
