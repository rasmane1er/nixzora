import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { KafkaService, type OutgoingMessage } from '../src/kafka/kafka.service';
import { OutboxStreamer, type StreamedEvent } from '../src/modules/outbox/outbox-streamer';
import { PrismaService } from '../src/prisma/prisma.service';

/** The outbox → Kafka relay (ADR-0020), against a recording stand-in for Kafka. */
describe('Outbox streaming to Kafka (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let streamer: OutboxStreamer;
  const sent: OutgoingMessage[] = [];
  let failNext = false;
  const run = Date.now().toString(36);

  const kafka = {
    enabled: true,
    topicPrefix: 'nixzora',
    topicFor: (aggregate: string) => `nixzora.${aggregate.replace(/_/g, '-')}.events`,
    deadLetterTopic: (topic: string) => `${topic}.dlq`,
    ensureTopics: jest.fn(async () => undefined),
    consumer: jest.fn(),
    publish: jest.fn(async (messages: OutgoingMessage[]) => {
      if (failNext) {
        failNext = false;
        throw new Error('broker unavailable');
      }
      sent.push(...messages);
    }),
    onModuleDestroy: async () => undefined,
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(KafkaService)
      .useValue(kafka)
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    streamer = app.get(OutboxStreamer);
  }, 30_000);

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({
      where: { aggregateId: { startsWith: `stream-${run}` } },
    });
    await app.close();
  });

  const record = (aggregateType: string, aggregateId: string, type: string) =>
    prisma.outboxEvent.create({
      data: { aggregateType, aggregateId: `stream-${run}-${aggregateId}`, type, payload: { n: 1 } },
    });
  const ours = () => sent.filter((m) => m.key.startsWith(`stream-${run}`));

  it('sends every event type to its aggregate topic, keyed by the aggregate, once', async () => {
    const paid = await record('order', 'o1', 'order.paid');
    const shipped = await record('order', 'o1', 'order.shipped');
    const product = await record('product', 'p1', 'catalog.product.updated');
    const sellerOrder = await record('seller_order', 's1', 'seller.order.created');

    expect(await streamer.stream()).toBeGreaterThanOrEqual(4);
    const messages = ours();
    expect(messages.map((m) => [m.topic, m.headers['event-type']])).toEqual([
      ['nixzora.order.events', 'order.paid'],
      ['nixzora.order.events', 'order.shipped'],
      ['nixzora.product.events', 'catalog.product.updated'],
      ['nixzora.seller-order.events', 'seller.order.created'],
    ]);
    const first = JSON.parse(messages[0]!.value) as StreamedEvent;
    expect(first).toMatchObject({
      id: paid.id,
      type: 'order.paid',
      aggregateType: 'order',
      aggregateId: `stream-${run}-o1`,
      payload: { n: 1 },
    });
    expect(messages[0]!.headers['event-id']).toBe(paid.id);
    expect(messages[0]!.key).toBe(messages[1]!.key);

    const rows = await prisma.outboxEvent.findMany({
      where: { id: { in: [paid.id, shipped.id, product.id, sellerOrder.id] } },
    });
    expect(rows.every((row) => row.streamedAt)).toBe(true);
    // Streaming does not count as delivery to the in-process handlers (emails, push…).
    expect(rows.every((row) => row.publishedAt === null)).toBe(true);

    sent.length = 0;
    await streamer.stream();
    expect(ours()).toEqual([]);
  });

  it('keeps events waiting when Kafka does not acknowledge them', async () => {
    const event = await record('return', 'r1', 'return.approved');
    failNext = true;
    await expect(streamer.stream()).rejects.toThrow('broker unavailable');
    expect(
      (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).streamedAt,
    ).toBeNull();
    expect((await streamer.stats()).backlog).toBeGreaterThanOrEqual(1);

    await streamer.stream();
    expect(ours().some((m) => m.headers['event-id'] === event.id)).toBe(true);
    expect(
      (await prisma.outboxEvent.findUniqueOrThrow({ where: { id: event.id } })).streamedAt,
    ).not.toBeNull();
  });
});
