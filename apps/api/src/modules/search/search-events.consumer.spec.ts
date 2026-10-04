import { type ConfigService } from '@nestjs/config';
import { type KafkaMessage } from 'kafkajs';
import { type Env } from '../../config/env';
import { type KafkaService } from '../../kafka/kafka.service';
import { type SearchEngine } from './search-engine';
import { SearchEventsConsumer, type SearchConsumerRole } from './search-events.consumer';

function build(
  settings: Partial<Record<keyof Env, unknown>>,
  role: SearchConsumerRole,
  indexProduct: jest.Mock = jest.fn(async () => true),
) {
  const publish = jest.fn(async () => undefined);
  const kafka = {
    enabled: Boolean((settings.KAFKA_BROKERS as string[] | undefined)?.length),
    topicPrefix: 'nixzora',
    topicFor: (aggregate: string) => `nixzora.${aggregate}.events`,
    deadLetterTopic: (topic: string) => `${topic}.dlq`,
    publish,
  } as unknown as KafkaService;
  const config = {
    get: (key: keyof Env) =>
      key in settings ? settings[key] : key === 'BACKGROUND_JOBS' ? true : undefined,
  } as unknown as ConfigService<Env, true>;
  const engine = { indexProduct } as unknown as SearchEngine;
  return { consumer: new SearchEventsConsumer(kafka, engine, config, role), publish, indexProduct };
}

const message = (event: Record<string, unknown>) =>
  ({ value: Buffer.from(JSON.stringify(event)) }) as unknown as KafkaMessage;
const KAFKA = {
  SEARCH_INDEX_EVENTS: 'kafka',
  KAFKA_BROKERS: ['localhost:9092'],
  NODE_ENV: 'development',
};

describe('SearchEventsConsumer', () => {
  it('runs only in the process that owns the index, in Kafka mode', () => {
    expect(build({ ...KAFKA }, 'search-service').consumer.active).toBe(true);
    expect(build({ ...KAFKA, NODE_ENV: 'test' }, 'search-service').consumer.active).toBe(false);
    expect(
      build({ ...KAFKA, SEARCH_INDEX_EVENTS: 'outbox' }, 'search-service').consumer.active,
    ).toBe(false);
    expect(build({ ...KAFKA, KAFKA_BROKERS: [] }, 'search-service').consumer.active).toBe(false);
    // The API image consumes only when search runs in-process and background jobs run here.
    expect(build({ ...KAFKA }, 'api').consumer.active).toBe(true);
    expect(
      build({ ...KAFKA, SEARCH_SERVICE_URL: 'http://search:4100' }, 'api').consumer.active,
    ).toBe(false);
    expect(build({ ...KAFKA, BACKGROUND_JOBS: false }, 'api').consumer.active).toBe(false);
  });

  it('indexes created and updated products and ignores everything else', async () => {
    const { consumer, indexProduct } = build({ ...KAFKA }, 'search-service');
    await consumer.handle(
      'nixzora.product.events',
      message({ id: 'e1', type: 'catalog.product.updated', aggregateId: 'p1' }),
    );
    await consumer.handle(
      'nixzora.product.events',
      message({ id: 'e2', type: 'catalog.product.archived', aggregateId: 'p2' }),
    );
    await consumer.handle('nixzora.product.events', {
      value: Buffer.from('not json'),
    } as unknown as KafkaMessage);
    expect(indexProduct).toHaveBeenCalledTimes(1);
    expect(indexProduct).toHaveBeenCalledWith('p1');
  });

  it('retries, then sends the event to the dead-letter topic and moves on', async () => {
    jest.useFakeTimers();
    const failing = jest.fn(async () => {
      throw new Error('embedding provider down');
    });
    const { consumer, publish } = build({ ...KAFKA }, 'search-service', failing);
    const done = consumer.handle(
      'nixzora.product.events',
      message({ id: 'e3', type: 'catalog.product.created', aggregateId: 'p3' }),
    );
    await jest.runAllTimersAsync();
    await done;
    jest.useRealTimers();
    expect(failing).toHaveBeenCalledTimes(3);
    expect(publish).toHaveBeenCalledWith([
      expect.objectContaining({
        topic: 'nixzora.product.events.dlq',
        key: 'p3',
        headers: expect.objectContaining({
          'event-id': 'e3',
          error: 'embedding provider down',
          consumer: 'nixzora-search-indexer',
        }),
      }),
    ]);
  });
});
