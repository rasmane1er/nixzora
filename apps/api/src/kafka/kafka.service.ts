import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { generateAuthToken } from 'aws-msk-iam-sasl-signer-js';
import {
  type Admin,
  type Consumer,
  type ConsumerConfig,
  Kafka,
  type KafkaConfig,
  logLevel,
  type Message,
  type Producer,
} from 'kafkajs';
import { type Env } from '../config/env';

/** A message for one topic: the key keeps one aggregate's events in order (same partition). */
export type OutgoingMessage = {
  topic: string;
  key: string;
  value: string;
  headers: Record<string, string>;
};

/**
 * The Kafka connection (ADR-0020), shared by the outbox streamer and consumers. Off unless
 * KAFKA_BROKERS is set. On Amazon MSK it signs in with the task's IAM role (no passwords);
 * locally it talks plain Kafka (Redpanda or Apache Kafka in Docker).
 */
@Injectable()
export class KafkaService implements OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private readonly kafka?: Kafka;
  private producerReady?: Promise<Producer>;
  private readonly consumers: Consumer[] = [];
  private readonly knownTopics = new Set<string>();
  readonly topicPrefix: string;
  private readonly partitions: number;
  private readonly replicationFactor: number;

  constructor(config: ConfigService<Env, true>) {
    this.topicPrefix = config.get('KAFKA_TOPIC_PREFIX', { infer: true });
    this.partitions = config.get('KAFKA_TOPIC_PARTITIONS', { infer: true });
    this.replicationFactor = config.get('KAFKA_REPLICATION_FACTOR', { infer: true });
    const brokers = config.get('KAFKA_BROKERS', { infer: true });
    if (!brokers.length) return;

    const iam = config.get('KAFKA_AUTH', { infer: true }) === 'aws-iam';
    const region = config.get('KAFKA_REGION', { infer: true });
    const settings: KafkaConfig = {
      clientId: config.get('KAFKA_CLIENT_ID', { infer: true }),
      brokers,
      ssl: iam || config.get('KAFKA_TLS', { infer: true }),
      connectionTimeout: 5_000,
      logLevel: logLevel.WARN,
      logCreator: () => (entry) => {
        const message = `${entry.namespace}: ${entry.log.message}`;
        if (entry.level <= logLevel.ERROR) this.logger.error(message);
        else this.logger.warn(message);
      },
    };
    if (iam) {
      // MSK IAM: short-lived tokens signed with the task role's credentials.
      settings.sasl = {
        mechanism: 'oauthbearer',
        oauthBearerProvider: async () => ({ value: (await generateAuthToken({ region })).token }),
      };
    }
    this.kafka = new Kafka(settings);
  }

  get enabled(): boolean {
    return Boolean(this.kafka);
  }

  /** "nixzora.order.events" for aggregate "order". */
  topicFor(aggregateType: string): string {
    const name = aggregateType.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${this.topicPrefix}.${name}.events`;
  }

  /** Dead letters: messages a consumer could not process after retrying. */
  deadLetterTopic(topic: string): string {
    return `${topic}.dlq`;
  }

  /** Creates topics that do not exist yet (idempotent). */
  async ensureTopics(topics: string[]): Promise<void> {
    const missing = topics.filter((topic) => !this.knownTopics.has(topic));
    if (!missing.length || !this.kafka) return;
    const admin: Admin = this.kafka.admin();
    await admin.connect();
    try {
      const existing = new Set(await admin.listTopics());
      const create = missing.filter((topic) => !existing.has(topic));
      if (create.length) {
        await admin.createTopics({
          waitForLeaders: true,
          topics: create.map((topic) => ({
            topic,
            numPartitions: this.partitions,
            replicationFactor: this.replicationFactor,
          })),
        });
        this.logger.log(`Created Kafka topics: ${create.join(', ')}`);
      }
      for (const topic of missing) this.knownTopics.add(topic);
    } finally {
      await admin.disconnect();
    }
  }

  /**
   * Sends messages and resolves once every broker in the in-sync replica set has them
   * (idempotent producer, acks=all), so callers can mark them as delivered.
   */
  async publish(messages: OutgoingMessage[]): Promise<void> {
    if (!messages.length) return;
    const producer = await this.producer();
    const byTopic = new Map<string, Message[]>();
    for (const { topic, key, value, headers } of messages) {
      byTopic.set(topic, [...(byTopic.get(topic) ?? []), { key, value, headers }]);
    }
    await this.ensureTopics([...byTopic.keys()]);
    await producer.sendBatch({
      acks: -1,
      topicMessages: [...byTopic].map(([topic, list]) => ({ topic, messages: list })),
    });
  }

  /** A consumer in `groupId`; disconnected when the app stops. */
  consumer(config: ConsumerConfig): Consumer {
    if (!this.kafka) throw new Error('Kafka is not configured (KAFKA_BROKERS).');
    const consumer = this.kafka.consumer(config);
    this.consumers.push(consumer);
    return consumer;
  }

  private producer(): Promise<Producer> {
    if (!this.kafka) return Promise.reject(new Error('Kafka is not configured (KAFKA_BROKERS).'));
    this.producerReady ??= (async () => {
      const producer = this.kafka!.producer({
        idempotent: true,
        maxInFlightRequests: 1,
        allowAutoTopicCreation: false,
      });
      await producer.connect();
      return producer;
    })().catch((error: unknown) => {
      this.producerReady = undefined;
      throw error;
    });
    return this.producerReady;
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled([
      ...this.consumers.map((consumer) => consumer.disconnect()),
      this.producerReady?.then((producer) => producer.disconnect()),
    ]);
  }
}
