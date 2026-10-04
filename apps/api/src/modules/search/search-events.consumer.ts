import { Inject, Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type Consumer, type KafkaMessage } from 'kafkajs';
import { runsBackgroundJobs } from '../../common/background-jobs';
import { type Env } from '../../config/env';
import { KafkaService } from '../../kafka/kafka.service';
import { type StreamedEvent } from '../outbox/outbox-streamer';
import { SearchEngine } from './search-engine';

/** Which process this is: the search service, or the API / worker. */
export const SEARCH_CONSUMER_ROLE = Symbol('SEARCH_CONSUMER_ROLE');
export type SearchConsumerRole = 'search-service' | 'api';

const INDEXED_TYPES = new Set(['catalog.product.created', 'catalog.product.updated']);
const ATTEMPTS = 3;

/**
 * Keeps the search index current from Kafka (ADR-0020, SEARCH_INDEX_EVENTS=kafka): the process
 * that owns the index (the search service, or the worker when search runs in-process) reads the
 * product topic in its own consumer group. A product that cannot be indexed after three tries
 * goes to the dead-letter topic and the consumer moves on; the next full reindex (at start-up)
 * catches it.
 */
@Injectable()
export class SearchEventsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(SearchEventsConsumer.name);
  private consumer?: Consumer;

  constructor(
    private readonly kafka: KafkaService,
    private readonly engine: SearchEngine,
    private readonly config: ConfigService<Env, true>,
    @Inject(SEARCH_CONSUMER_ROLE) private readonly role: SearchConsumerRole,
  ) {}

  /** "nixzora-search-indexer": named after the topic prefix (the MSK IAM policy expects it). */
  get group(): string {
    return `${this.kafka.topicPrefix}-search-indexer`;
  }

  /** Whether this process should consume (also used by the outbox indexer to stand down). */
  get active(): boolean {
    if (this.config.get('SEARCH_INDEX_EVENTS', { infer: true }) !== 'kafka') return false;
    if (!this.kafka.enabled) return false;
    if (this.role === 'search-service')
      return this.config.get('NODE_ENV', { infer: true }) !== 'test';
    // In the API image: only where background jobs run, and only when search is in-process.
    return (
      !this.config.get('SEARCH_SERVICE_URL', { infer: true }) && runsBackgroundJobs(this.config)
    );
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.active) return;
    const topic = this.kafka.topicFor('product');
    try {
      await this.kafka.ensureTopics([topic, this.kafka.deadLetterTopic(topic)]);
      this.consumer = this.kafka.consumer({ groupId: this.group });
      await this.consumer.connect();
      await this.consumer.subscribe({ topic, fromBeginning: true });
      await this.consumer.run({
        eachMessage: ({ message }) => this.handle(topic, message),
      });
      this.logger.log(`Indexing products from Kafka topic ${topic}`);
    } catch (error) {
      // Search keeps working (queries, the start-up reindex); indexing waits for a restart.
      this.logger.error(`Could not start the Kafka search consumer: ${(error as Error).message}`);
    }
  }

  /** One message: index the product, retrying briefly; dead-letter it if that keeps failing. */
  async handle(topic: string, message: KafkaMessage): Promise<void> {
    let event: StreamedEvent;
    try {
      event = JSON.parse(message.value?.toString() ?? '') as StreamedEvent;
    } catch {
      this.logger.warn(`Skipping an unreadable message on ${topic}`);
      return;
    }
    if (!INDEXED_TYPES.has(event.type)) return;

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
      try {
        await this.engine.indexProduct(event.aggregateId);
        return;
      } catch (error) {
        lastError = error as Error;
        await new Promise((resolve) => setTimeout(resolve, 250 * attempt));
      }
    }
    this.logger.error(
      `Indexing product ${event.aggregateId} failed ${ATTEMPTS} times: ${lastError?.message}`,
    );
    await this.kafka.publish([
      {
        topic: this.kafka.deadLetterTopic(topic),
        key: event.aggregateId,
        value: message.value?.toString() ?? '',
        headers: {
          'event-id': event.id,
          'event-type': event.type,
          'content-type': 'application/json',
          error: (lastError?.message ?? 'unknown').slice(0, 500),
          consumer: this.group,
        },
      },
    ]);
  }
}
