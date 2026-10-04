import 'dotenv/config';

/**
 * Against a real Kafka broker (CI runs one): the relay's messages arrive, in order per key.
 * Skipped unless KAFKA_TEST_BROKERS is set, e.g. KAFKA_TEST_BROKERS=localhost:9092.
 */
const brokers = process.env.KAFKA_TEST_BROKERS;
const run = Date.now().toString(36);
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
if (brokers) {
  process.env.KAFKA_BROKERS = brokers;
  process.env.KAFKA_TOPIC_PREFIX = `test-${run}`;
  process.env.KAFKA_TOPIC_PARTITIONS = '2';
  process.env.KAFKA_REPLICATION_FACTOR = '1';
}

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Kafka, logLevel } from 'kafkajs';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { KafkaService } from '../src/kafka/kafka.service';
import { OutboxStreamer, type StreamedEvent } from '../src/modules/outbox/outbox-streamer';
import { PrismaService } from '../src/prisma/prisma.service';

(brokers ? describe : describe.skip)('Kafka broker (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  }, 60_000);

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { startsWith: `kafka-${run}` } } });
    await app.close();
  });

  it('delivers outbox events to the aggregate topic, in order for each order', async () => {
    const kafka = app.get(KafkaService);
    expect(kafka.enabled).toBe(true);
    const ids: string[] = [];
    for (const type of ['order.paid', 'order.shipped', 'order.delivered']) {
      const row = await prisma.outboxEvent.create({
        data: { aggregateType: 'order', aggregateId: `kafka-${run}-o1`, type, payload: { type } },
      });
      ids.push(row.id);
    }
    await app.get(OutboxStreamer).stream();

    const topic = kafka.topicFor('order');
    expect(topic).toBe(`test-${run}.order.events`);
    const reader = new Kafka({
      clientId: 'e2e',
      brokers: brokers!.split(','),
      logLevel: logLevel.NOTHING,
    });
    const consumer = reader.consumer({ groupId: `e2e-${run}` });
    await consumer.connect();
    await consumer.subscribe({ topic, fromBeginning: true });
    const received: StreamedEvent[] = [];
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`only ${received.length} messages`)), 30_000);
      void consumer.run({
        eachMessage: async ({ message }) => {
          const event = JSON.parse(message.value!.toString()) as StreamedEvent;
          if (event.aggregateId !== `kafka-${run}-o1`) return;
          received.push(event);
          if (received.length === 3) {
            clearTimeout(timer);
            resolve();
          }
        },
      });
    });
    await consumer.disconnect();
    expect(received.map((event) => event.id)).toEqual(ids);
    expect(received.map((event) => event.type)).toEqual([
      'order.paid',
      'order.shipped',
      'order.delivered',
    ]);
  }, 60_000);
});
