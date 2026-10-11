import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  addDays,
  arriveByChoices,
  deliveryWindow,
  easternToday,
  type ProductPage,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Get it by (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  let categoryId: string;

  async function seller(key: string, handlingDays: number, away = false) {
    return prisma.seller.create({
      data: {
        handle: `ab${key}-${run}`,
        displayName: `Arrive ${key}`,
        legalName: `Arrive ${key} LLC`,
        contactEmail: `ab-${key}-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        handlingDays,
        ...(away ? { vacationFrom: new Date(`${easternToday()}T00:00:00Z`) } : {}),
      },
    });
  }

  async function product(key: string, sellerId: string | null, extra: object = {}, onHand = 5) {
    await prisma.product.create({
      data: {
        slug: `ab-${key}-${run}`,
        title: `Arrive ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId,
        ...extra,
        variants: {
          create: {
            sku: `AB-${key}-${run}`.toUpperCase(),
            title: 'Standard',
            priceCents: 2_000,
            inventory: { create: { onHand } },
          },
        },
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    categoryId = (await prisma.category.create({ data: { slug: `abcat-${run}`, name: 'Arrive' } }))
      .id;
    const fast = await seller('fast', 1);
    const slow = await seller('slow', 10);
    const away = await seller('away', 1, true);
    await product('own', null);
    await product('fast', fast.id);
    await product('slow', slow.id);
    await product('away', away.id);
    await product('soldout', null, {}, 0);
    await product('preorder', null, {
      releaseDate: new Date(`${addDays(easternToday(), 20)}T00:00:00Z`),
    });
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const keys = async (arriveBy?: string) => {
    const res = await http()
      .get('/api/v1/catalog/products')
      .query({ category: `abcat-${run}`, ...(arriveBy ? { arriveBy } : {}) })
      .expect(200);
    return (res.body as ProductPage).items.map((p) => p.slug.split('-')[1]).sort();
  };

  it('lists everything without the filter', async () => {
    expect(await keys()).toEqual(['away', 'fast', 'own', 'preorder', 'slow', 'soldout']);
  });

  it('keeps only what arrives in time, from open stores, in stock', async () => {
    expect(await keys(arriveByChoices()[0])).toEqual(['fast', 'own']);
    expect(await keys(deliveryWindow(new Date(), 10).latest)).toEqual(['fast', 'own', 'slow']);
  });

  it('shows nothing for a day nothing can make, and rejects a bad date', async () => {
    expect(await keys(easternToday())).toEqual([]);
    await http().get('/api/v1/catalog/products').query({ arriveBy: 'friday' }).expect(400);
  });
});
