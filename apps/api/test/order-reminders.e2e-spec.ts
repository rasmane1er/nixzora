import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type CheckoutResponse,
  easternToday,
  type OrderView,
  type ProductDetail,
  RETURN_WINDOW_DAYS,
  type WarrantyView,
  warrantyUntil,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { RemindersService } from '../src/modules/reminders/reminders.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Grace Hopper',
  line1: '1 Navy Way',
  city: 'Arlington',
  region: 'VA',
  postalCode: '22202',
  country: 'US',
};
const DAY = 86_400_000;

describe('Warranty tracker and order reminders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let reminders: RemindersService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const products: Record<string, { id: string; variantId: string }> = {};
  let ownerToken: string;
  let shopperToken: string;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function product(key: string, categoryId: string, seller: string, priceCents: number) {
    const created = await prisma.product.create({
      data: {
        slug: `wr-${key}-${run}`,
        title: `Warranty test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: {
            sku: `WR-${key}-${run}`.toUpperCase(),
            title: 'Standard',
            priceCents,
            inventory: { create: { onHand: 20 } },
          },
        },
      },
      include: { variants: true },
    });
    products[key] = { id: created.id, variantId: created.variants[0]!.id };
  }

  async function buy(keys: string[]): Promise<OrderView> {
    for (const key of keys) {
      await http()
        .post('/api/v1/cart/items')
        .set(bearer(shopperToken))
        .send({ variantId: products[key]!.variantId, quantity: 1 })
        .expect(201);
    }
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(shopperToken))
        .send({ email: `wr-shopper-${run}@example.com`, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    await app.get(OutboxService).drain();
    return view(checkout.orderNumber);
  }

  const view = async (number: string) =>
    (await http().get(`/api/v1/orders/${number}`).set(bearer(shopperToken)).expect(200))
      .body as OrderView;

  const delivered = (number: string, daysAgo: number) =>
    prisma.order.update({
      where: { number },
      data: {
        status: 'DELIVERED',
        placedAt: new Date(Date.now() - (daysAgo + 3) * DAY),
        deliveredAt: new Date(Date.now() - daysAgo * DAY),
      },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    reminders = app.get(RemindersService);
    ownerToken = await signUp(`wr-owner-${run}@example.com`);
    shopperToken = await signUp(`wr-shopper-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `wr-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `wrshop-${run}`,
        displayName: 'Warranty Shop',
        legalName: 'Warranty Shop LLC',
        contactEmail: `wr-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    const cat = await prisma.category.create({ data: { slug: `wrcat-${run}`, name: 'Warranty' } });
    await product('speaker', cat.id, seller.id, 12_000);
    await product('cable', cat.id, seller.id, 1_500);
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const edit = (body: object, status: number) =>
    http()
      .patch(`/api/v1/seller/products/${products.speaker!.id}`)
      .set(bearer(ownerToken))
      .send(body)
      .expect(status);

  it('lets a store set a warranty of up to ten years, shown on the product page', async () => {
    await edit({ warrantyMonths: 0 }, 400);
    await edit({ warrantyMonths: 121 }, 400);
    await edit({ warrantyMonths: 24 }, 200);
    const detail = (await http().get(`/api/v1/catalog/products/wr-speaker-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.warrantyMonths).toBe(24);
  });

  let order: OrderView;

  it('keeps the warranty on the order line, from the day it was bought', async () => {
    order = await buy(['speaker', 'cable']);
    // Changing the listing later doesn't change what was bought.
    await edit({ warrantyMonths: 6 }, 200);
    const speaker = order.items.find((i) => i.sku === `WR-SPEAKER-${run}`.toUpperCase())!;
    const cable = order.items.find((i) => i.sku === `WR-CABLE-${run}`.toUpperCase())!;
    expect(speaker.warrantyUntil).toBe(warrantyUntil(easternToday(), 24));
    expect(cable.warrantyUntil).toBeNull();
    const list = (await http().get('/api/v1/me/warranties').set(bearer(shopperToken)).expect(200))
      .body as WarrantyView[];
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      orderNumber: order.number,
      months: 24,
      status: 'ACTIVE',
      seller: { handle: `wrshop-${run}`, displayName: 'Warranty Shop' },
    });
  });

  it('runs the warranty from delivery', async () => {
    await delivered(order.number, 1);
    const from = easternToday(new Date(Date.now() - DAY));
    const speaker = (await view(order.number)).items.find((i) => i.warrantyUntil)!;
    expect(speaker.warrantyUntil).toBe(warrantyUntil(from, 24));
  });

  it('reminds once, two days before returns close', async () => {
    await delivered(order.number, RETURN_WINDOW_DAYS - 1);
    await reminders.sweep();
    const first = await prisma.order.findUniqueOrThrow({ where: { number: order.number } });
    expect(first.returnRemindedAt).not.toBeNull();
    await reminders.sweep();
    const again = await prisma.order.findUniqueOrThrow({ where: { number: order.number } });
    expect(again.returnRemindedAt).toEqual(first.returnRemindedAt);
  });

  it('skips orders with a return, and customers who turned reminders off', async () => {
    const returned = await buy(['cable']);
    await delivered(returned.number, RETURN_WINDOW_DAYS - 1);
    await prisma.returnRequest.create({
      data: {
        orderId: returned.id,
        reason: 'Changed my mind',
        items: [{ orderItemId: returned.items[0]!.id, quantity: 1 }],
      },
    });
    const muted = await buy(['cable']);
    await delivered(muted.number, RETURN_WINDOW_DAYS - 1);
    const prefs = await http().get('/api/v1/me/preferences').set(bearer(shopperToken)).expect(200);
    expect(prefs.body.orderReminders).toBe(true);
    await http()
      .put('/api/v1/me/preferences')
      .set(bearer(shopperToken))
      .send({ ...prefs.body, orderReminders: false })
      .expect(200);
    await reminders.sweep();
    for (const number of [returned.number, muted.number]) {
      const row = await prisma.order.findUniqueOrThrow({ where: { number } });
      expect(row.returnRemindedAt).toBeNull();
    }
    await http()
      .put('/api/v1/me/preferences')
      .set(bearer(shopperToken))
      .send({ ...prefs.body, orderReminders: true })
      .expect(200);
  });

  it('reminds once, three weeks before a warranty ends', async () => {
    // Delivered almost two years ago: ten days of cover left.
    const deliveredAt = new Date(Date.now() - (2 * 365 - 10) * DAY);
    await prisma.order.update({
      where: { number: order.number },
      data: { deliveredAt, placedAt: new Date(deliveredAt.getTime() - 3 * DAY) },
    });
    const list = (await http().get('/api/v1/me/warranties').set(bearer(shopperToken)).expect(200))
      .body as WarrantyView[];
    expect(list[0]?.status).toBe('ENDING_SOON');
    await reminders.sweep();
    const item = await prisma.orderItem.findFirstOrThrow({
      where: { orderId: order.id, warrantyMonths: 24 },
    });
    expect(item.warrantyRemindedAt).not.toBeNull();
    await reminders.sweep();
    const again = await prisma.orderItem.findUniqueOrThrow({ where: { id: item.id } });
    expect(again.warrantyRemindedAt).toEqual(item.warrantyRemindedAt);
  });
});
