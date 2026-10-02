import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.AI_DRIVER = 'local';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.SEARCH_MODE = 'hybrid';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AssistantChatResponseSchema } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Intelligence layer: hybrid search and the shopping assistant (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let outbox: OutboxService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  let travelId: string;
  let observatoryId: string;

  async function createProduct(input: {
    slug: string;
    title: string;
    description: string;
    attributes: Record<string, number>;
    priceCents: number;
    categoryId: string;
  }) {
    const product = await prisma.product.create({
      data: {
        slug: `${input.slug}-${run}`,
        title: input.title,
        description: input.description,
        status: 'ACTIVE',
        categoryId: input.categoryId,
        attributes: input.attributes,
        variants: {
          create: [
            {
              sku: `${input.slug}-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: input.priceCents,
              inventory: { create: { onHand: 5 } },
            },
          ],
        },
      },
    });
    // The same event the Ops Center writes; the search indexer listens for it.
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: product.id,
        type: 'catalog.product.created',
        payload: { productId: product.id },
      },
    });
    return product.id;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    outbox = app.get(OutboxService);

    const category = await prisma.category.create({
      data: { slug: `telescopes-${run}`, name: 'Telescopes' },
    });
    travelId = await createProduct({
      slug: 'stargazer-80',
      title: `Stargazer 80 travel telescope ${run}`,
      description: 'A compact refractor that packs into a backpack: set up in a minute at camp.',
      attributes: { weight_kg: 1.2, aperture_mm: 80 },
      priceCents: 24_900,
      categoryId: category.id,
    });
    observatoryId = await createProduct({
      slug: 'observatory-200',
      title: `Observatory 200 dobsonian telescope ${run}`,
      description: 'A large-aperture telescope for the backyard. Heavy, best left at home.',
      attributes: { weight_kg: 19, aperture_mm: 200 },
      priceCents: 89_900,
      categoryId: category.id,
    });
    await outbox.drain();
  }, 30_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  it('indexes new products from catalog outbox events', async () => {
    const docs = await prisma.productSearchDoc.findMany({
      where: { productId: { in: [travelId, observatoryId] } },
      select: { productId: true, embeddingModel: true, facetsText: true },
    });
    expect(docs).toHaveLength(2);
    expect(docs[0]!.embeddingModel).toMatch(/^local-hash-v1-/);
    const vectors = await prisma.$queryRaw<{ n: number }[]>`
      SELECT count(*)::int AS n FROM product_search_docs
      WHERE product_id = ANY(${[travelId, observatoryId]}::uuid[]) AND embedding IS NOT NULL`;
    expect(vectors[0]!.n).toBe(2);
  });

  it('re-indexes a product when it changes, and skips unchanged ones', async () => {
    const before = await prisma.productSearchDoc.findUniqueOrThrow({
      where: { productId: travelId },
    });
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: travelId,
        type: 'catalog.product.updated',
        payload: { productId: travelId },
      },
    });
    await outbox.drain();
    const same = await prisma.productSearchDoc.findUniqueOrThrow({
      where: { productId: travelId },
    });
    expect(same.updatedAt).toEqual(before.updatedAt);

    await prisma.product.update({
      where: { id: travelId },
      data: { description: `${before.bodyText} Includes a phone adapter.` },
    });
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: travelId,
        type: 'catalog.product.updated',
        payload: { productId: travelId },
      },
    });
    await outbox.drain();
    const after = await prisma.productSearchDoc.findUniqueOrThrow({
      where: { productId: travelId },
    });
    expect(after.bodyText).toContain('phone adapter');
    expect(after.contentHash).not.toBe(before.contentHash);
  });

  it('finds products by meaning, not only by shared words', async () => {
    const res = await http()
      .get('/api/v1/catalog/products')
      .query({ q: `portable telescope to take camping ${run}` })
      .expect(200);
    const titles = (res.body.items as { title: string }[]).map((item) => item.title);
    expect(titles[0]).toContain('Stargazer 80');
  });

  it('answers with real products inside the budget and a comparison', async () => {
    const res = await http()
      .post('/api/v1/assistant/chat')
      .send({ messages: [{ role: 'user', content: 'a light telescope for trips under $300' }] })
      .expect(200);
    const body = AssistantChatResponseSchema.parse(res.body);
    expect(body.need).toMatchObject({ category: `telescopes-${run}`, maxPriceCents: 30_000 });
    expect(body.need.mustHave).toEqual(expect.arrayContaining(['lightweight', 'good for travel']));
    expect(body.picks.map((p) => p.product.id)).toEqual([travelId]);
    expect(body.picks[0]!.badge).toBe('Best match');
    expect(body.picks[0]!.variantId).toEqual(expect.any(String));
    expect(body.reply).toContain('Stargazer 80');
    expect(body.relaxed).toEqual([]);
    expect(body.model).toBe('local');

    const logged = await prisma.aiRequest.findFirst({
      where: { feature: 'assistant', createdAt: { gte: new Date(Date.now() - 60_000) } },
      orderBy: { createdAt: 'desc' },
    });
    expect(logged).toMatchObject({ driver: 'local', grounded: true, costMicros: 0 });
  });

  it('relaxes the budget when nothing fits, and says so', async () => {
    const res = await http()
      .post('/api/v1/assistant/chat')
      .send({ messages: [{ role: 'user', content: 'a telescope under $50' }] })
      .expect(200);
    const body = AssistantChatResponseSchema.parse(res.body);
    expect(body.relaxed).toEqual(['your budget']);
    expect(body.reply).toMatch(/^Nothing matched everything/);
    expect(body.picks.length).toBeGreaterThan(0);
    expect(body.comparison?.rows.map((row) => row.label)).toEqual(
      expect.arrayContaining(['Price', 'Weight']),
    );
  });

  it('uses the whole conversation: later turns refine earlier ones', async () => {
    const res = await http()
      .post('/api/v1/assistant/chat')
      .send({
        messages: [
          { role: 'user', content: 'a telescope under $1,000' },
          { role: 'assistant', content: 'Here are two telescopes.' },
          { role: 'user', content: 'actually under $300' },
        ],
      })
      .expect(200);
    const body = AssistantChatResponseSchema.parse(res.body);
    expect(body.need.maxPriceCents).toBe(30_000);
    expect(body.picks.every((p) => p.product.priceFromCents <= 30_000)).toBe(true);
  });

  it('rejects conversations that do not end with the shopper', async () => {
    await http()
      .post('/api/v1/assistant/chat')
      .send({ messages: [{ role: 'assistant', content: 'Hello' }] })
      .expect(400);
  });
});
