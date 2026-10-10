import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type Cart,
  type CheckoutResponse,
  deliveryWindow,
  type ProductDetail,
  type ProductPage,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Card signals: bought in past month, delivery date (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const variants: Record<string, string> = {};

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const cat = await prisma.category.create({ data: { slug: `sigcat-${run}`, name: 'Signals' } });
    const seller = await prisma.seller.create({
      data: {
        handle: `sigshop-${run}`,
        displayName: 'Signal Shop',
        legalName: 'Signal Shop LLC',
        contactEmail: `sig-${run}@example.com`,
        status: 'ACTIVE',
        handlingDays: 3,
      },
    });
    for (const [key, price, sellerId] of [
      ['socks', 1_200, null],
      ['tent', 15_000, seller.id],
    ] as const) {
      const p = await prisma.product.create({
        data: {
          slug: `sig-${key}-${run}`,
          title: `Signal ${key} ${run}`,
          description: 'A test listing.',
          status: 'ACTIVE',
          categoryId: cat.id,
          sellerId,
          variants: {
            create: [
              {
                sku: `SIG-${key}-${run}`.toUpperCase(),
                title: 'Standard',
                priceCents: price,
                inventory: { create: { onHand: 100 } },
              },
            ],
          },
        },
        include: { variants: true },
      });
      variants[key] = p.variants[0]!.id;
    }
    // A shopper buys 12 pairs of socks (paid), and 30 more that are never paid.
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: `sig-shopper-${run}@example.com`, password: 'correct horse battery staple' })
      .expect(201);
    const token = AuthTokensSchema.parse(res.body).accessToken;
    const buy = async (quantity: number, pay: boolean) => {
      const cart = (
        await http()
          .post('/api/v1/cart/buy-now')
          .set({ Authorization: `Bearer ${token}` })
          .send({ variantId: variants.socks, quantity })
          .expect(201)
      ).body as Cart;
      const checkout = (
        await http()
          .post('/api/v1/checkout')
          .set({ Authorization: `Bearer ${token}` })
          .send({
            buyNowId: cart.cartId,
            email: `sig-shopper-${run}@example.com`,
            shippingAddress: {
              fullName: 'Mae Jemison',
              line1: '1 Space Rd',
              city: 'Decatur',
              region: 'AL',
              postalCode: '35601',
              country: 'US',
            },
          })
          .expect(201)
      ).body as CheckoutResponse;
      if (pay) {
        await http()
          .post('/api/v1/payments/fake/confirm')
          .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
          .expect(200);
      }
    };
    await buy(12, true);
    await buy(10, false);
    await app.get(OutboxService).drain();
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  it('shows "10+ bought in past month" from paid orders only, and when it arrives', async () => {
    const page = (await http().get(`/api/v1/catalog/products?category=sigcat-${run}`).expect(200))
      .body as ProductPage;
    const socks = page.items.find((p) => p.slug === `sig-socks-${run}`)!;
    const tent = page.items.find((p) => p.slug === `sig-tent-${run}`)!;
    expect(socks).toMatchObject({
      boughtPastMonth: 10,
      shipsFromNixzora: true,
      freeDelivery: false,
      delivery: deliveryWindow(new Date(), 1),
    });
    // Nobody bought the tent; it ships from its store, which takes 3 days, and it's free to ship.
    expect(tent).toMatchObject({
      boughtPastMonth: null,
      shipsFromNixzora: false,
      freeDelivery: true,
      delivery: deliveryWindow(new Date(), 3),
    });
    const detail = (await http().get(`/api/v1/catalog/products/sig-socks-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.boughtPastMonth).toBe(10);
  });
});
