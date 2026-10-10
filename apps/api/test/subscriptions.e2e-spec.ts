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
  type SubscribeResult,
  type SubscriptionView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/modules/notifications/mail.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { SubscriptionsService } from '../src/modules/subscriptions/subscriptions.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const address = {
  fullName: 'Ada Lovelace',
  line1: '100 Main St',
  city: 'Brandywine',
  region: 'MD',
  postalCode: '20613',
  country: 'US',
};

describe('Subscribe & Save (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  let sweeper: SubscriptionsService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const email = `subs-${run}@example.com`;
  let token: string;
  let newcomer: string;
  let sellerToken: string;
  const variants: Record<string, string> = {};
  const products: Record<string, string> = {};
  let first: SubscribeResult;

  async function signUp(address: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: address, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function product(key: string, priceCents: number, categoryId: string, sellerId?: string) {
    const created = await prisma.product.create({
      data: {
        slug: `sub-${key}-${run}`,
        title: `Subscribe test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: sellerId ?? null,
        variants: {
          create: [
            {
              sku: `SUB-${key}-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents,
              inventory: { create: { onHand: 50 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    products[key] = created.id;
    variants[key] = created.variants[0]!.id;
  }

  const subscribe = (auth: string, key: string, status = 201) =>
    http()
      .post('/api/v1/me/subscriptions')
      .set(bearer(auth))
      .send({ variantId: variants[key], quantity: 1, intervalDays: 30 })
      .expect(status);

  const mine = async () =>
    (await http().get('/api/v1/me/subscriptions').set(bearer(token)).expect(200))
      .body as SubscriptionView[];

  const makeDue = () =>
    prisma.subscription.updateMany({
      where: { user: { email }, status: 'ACTIVE' },
      data: { nextOrderAt: new Date(Date.now() - 60_000) },
    });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    sweeper = app.get(SubscriptionsService);
    token = await signUp(email);
    newcomer = await signUp(`subs-new-${run}@example.com`);
    sellerToken = await signUp(`subs-seller-${run}@example.com`);
    const sellerUser = await prisma.user.findUniqueOrThrow({
      where: { email: `subs-seller-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `subshop-${run}`,
        displayName: 'Sub Shop',
        legalName: 'Sub Shop LLC',
        contactEmail: `subs-seller-${run}@example.com`,
        status: 'ACTIVE',
        members: { create: { userId: sellerUser.id, role: 'OWNER' } },
      },
    });
    const cat = await prisma.category.create({ data: { slug: `subcat-${run}`, name: 'Subs' } });
    await product('a', 2_000, cat.id);
    await product('b', 3_000, cat.id);
    await product('c', 1_000, cat.id);
    await product('store', 4_000, cat.id, seller.id);

    // A saved card and an address, from a first purchase.
    const cart = (
      await http()
        .post('/api/v1/cart/buy-now')
        .set(bearer(token))
        .send({ variantId: variants.c, quantity: 1 })
        .expect(201)
    ).body as Cart;
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(token))
        .send({
          buyNowId: cart.cartId,
          email,
          shippingAddress: address,
          saveAddress: true,
          saveCard: true,
        })
        .expect(201)
    ).body as CheckoutResponse;
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
  }, 60_000);

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { user: { email: { contains: run } } } });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('needs a saved card and an address first', async () => {
    const res = await subscribe(newcomer, 'a', 409);
    expect(res.body.code).toBe('SUBSCRIBE_SETUP');
  });

  it("offers NIXZORA's products, and a store's only when it allows it", async () => {
    await subscribe(token, 'store', 409);
    await http()
      .post(`/api/v1/seller/products/${products.a}/subscribable`)
      .set(bearer(sellerToken))
      .send({ allowed: true })
      .expect(404);
    await http()
      .post(`/api/v1/seller/products/${products.store}/subscribable`)
      .set(bearer(sellerToken))
      .send({ allowed: true })
      .expect(200);
    const product = (await http().get(`/api/v1/catalog/products/sub-store-${run}`).expect(200))
      .body as { subscribable: boolean };
    expect(product.subscribable).toBe(true);
  });

  it('places the first delivery at once, 5% off, on the saved card', async () => {
    first = (await subscribe(token, 'a')).body as SubscribeResult;
    expect(first.order?.paid).toBe(true);
    const order = await prisma.order.findUniqueOrThrow({
      where: { number: first.order!.orderNumber },
      include: { items: true },
    });
    expect(order.status).toBe('PAID');
    expect(order.items[0]).toMatchObject({
      unitPriceCents: 1_900,
      subscriptionId: first.subscription.id,
    });
    expect(first.subscription).toMatchObject({ status: 'ACTIVE', intervalDays: 30, failures: 0 });
    expect(Date.parse(first.subscription.nextOrderAt!) - Date.now()).toBeGreaterThan(
      29 * 86_400_000,
    );
    await subscribe(token, 'a', 409);
    expect(mail.lastTo(email, 'subscriptions.created')?.text).toContain('until you cancel');
  });

  it('groups what is due into one order, 10% off with 3 or more', async () => {
    await subscribe(token, 'b');
    await subscribe(token, 'store');
    await makeDue();
    const before = await prisma.order.count({ where: { email } });
    expect(await sweeper.sweep()).toBe(1);
    expect(await prisma.order.count({ where: { email } })).toBe(before + 1);
    const order = await prisma.order.findFirstOrThrow({
      where: { email },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    expect(order.status).toBe('PAID');
    expect(order.items.map((i) => i.unitPriceCents).sort((x, y) => x - y)).toEqual([
      1_800, 2_700, 3_600,
    ]);
    expect(order.items.every((i) => i.subscriptionId)).toBe(true);
    // Moved on: nothing is due right after.
    expect(await sweeper.sweep()).toBe(0);
    await app.get(OutboxService).drain();
  });

  it('tells the customer when the card is declined, and pauses after three', async () => {
    await prisma.paymentCard.updateMany({
      where: { user: { email } },
      data: { providerMethodId: `fake_pm_decline_${run}` },
    });
    for (let i = 1; i <= 3; i++) {
      await makeDue();
      await sweeper.sweep();
      const subs = await prisma.subscription.findMany({ where: { user: { email } } });
      expect(subs.every((s) => s.failures === i)).toBe(true);
    }
    expect(mail.lastTo(email, 'subscriptions.charge-failed')?.text).toContain('/checkout/pay/');
    expect(mail.lastTo(email, 'subscriptions.paused')).toBeDefined();
    expect((await mine()).every((s) => s.status === 'PAUSED')).toBe(true);
  });

  it('lets the customer skip, change, resume and cancel', async () => {
    const sub = (await mine()).find((s) => s.product.id === products.a)!;
    const resumed = (
      await http()
        .patch(`/api/v1/me/subscriptions/${sub.id}`)
        .set(bearer(token))
        .send({ status: 'ACTIVE', quantity: 2, intervalDays: 60 })
        .expect(200)
    ).body as SubscriptionView;
    expect(resumed).toMatchObject({ status: 'ACTIVE', quantity: 2, intervalDays: 60, failures: 0 });
    const skipped = (
      await http()
        .patch(`/api/v1/me/subscriptions/${sub.id}`)
        .set(bearer(token))
        .send({ skipNext: true })
        .expect(200)
    ).body as SubscriptionView;
    expect(Date.parse(skipped.nextOrderAt!) - Date.parse(resumed.nextOrderAt!)).toBe(
      60 * 86_400_000,
    );
    await http().delete(`/api/v1/me/subscriptions/${sub.id}`).set(bearer(newcomer)).expect(404);
    await http().delete(`/api/v1/me/subscriptions/${sub.id}`).set(bearer(token)).expect(204);
    expect((await mine()).map((s) => s.id)).not.toContain(sub.id);
  });

  it('ends subscriptions when the store stops offering them', async () => {
    await http()
      .post(`/api/v1/seller/products/${products.store}/subscribable`)
      .set(bearer(sellerToken))
      .send({ allowed: false })
      .expect(200);
    expect((await mine()).map((s) => s.product.id)).not.toContain(products.store);
  });
});
