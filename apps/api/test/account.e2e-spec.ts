import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.PAYMENTS_PROVIDER = 'fake';
process.env.MAIL_DRIVER = 'log';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  type AccountOrder,
  type AccountOverview,
  AuthTokensSchema,
  type BuyAgainItem,
  type CheckoutResponse,
  type PagedResult,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
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

/** Your Account: overview, order history with actions, buy again, reviews, returns, data. */
describe('Your Account (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let token: string;
  let other: string;
  let lampVariant: string;
  let first: CheckoutResponse;
  let second: CheckoutResponse;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function buy(variantId: string, quantity = 1): Promise<CheckoutResponse> {
    await http()
      .post('/api/v1/cart/items')
      .set(bearer(token))
      .send({ variantId, quantity })
      .expect(201);
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(token))
        .send({ email: `acct-${run}@example.com`, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    return checkout;
  }

  beforeAll(async () => {
    app = (
      await Test.createTestingModule({ imports: [AppModule] }).compile()
    ).createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const category = await prisma.category.create({
      data: { name: `Lamps ${run}`, slug: `lamps-${run}` },
    });
    const make = (title: string, sku: string) =>
      prisma.product.create({
        data: {
          title: `${title} ${run}`,
          slug: `${title.toLowerCase().replace(/\s+/g, '-')}-${run}`,
          description: 'Test product.',
          status: 'ACTIVE',
          categoryId: category.id,
          variants: {
            create: [
              {
                sku: `${sku}-${run}`.toUpperCase(),
                title: 'Standard',
                priceCents: 4500,
                inventory: { create: { onHand: 10 } },
              },
            ],
          },
        },
        include: { variants: true },
      });
    lampVariant = (await make('Arc desk lamp', 'LAMP')).variants[0]!.id;
    const bulbVariant = (await make('Warm bulb', 'BULB')).variants[0]!.id;
    token = await signUp(`acct-${run}@example.com`);
    other = await signUp(`acct-other-${run}@example.com`);
    first = await buy(lampVariant, 2);
    second = await buy(bulbVariant);
    // The lamp order arrived yesterday.
    await prisma.order.update({
      where: { id: first.orderId },
      data: { status: 'DELIVERED', deliveredAt: new Date(Date.now() - 86_400_000) },
    });
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  it('updates the profile and greets the customer by name', async () => {
    await http()
      .patch('/api/v1/me/profile')
      .set(bearer(token))
      .send({ firstName: 'Ada', lastName: 'Lovelace', phone: '+1 301 555 0199' })
      .expect(200);
    await http()
      .patch('/api/v1/me/profile')
      .set(bearer(token))
      .send({ phone: 'call me' })
      .expect(400);
    const overview = (await http().get('/api/v1/me/overview').set(bearer(token)).expect(200))
      .body as AccountOverview;
    expect(overview.profile).toMatchObject({ firstName: 'Ada', phone: '+1 301 555 0199' });
    expect(overview.counts).toMatchObject({ orders: 2, openOrders: 1, toReview: 1, reviews: 0 });
    expect(overview.recentOrders.map((o) => o.number)).toEqual([
      second.orderNumber,
      first.orderNumber,
    ]);
    expect(overview.security).toMatchObject({ mfaEnabled: false, hasPassword: true });
    expect(overview.buyAgain.map((b) => b.title)).toEqual([`Arc desk lamp ${run}`]);
  });

  it('filters and searches the order history, with what each line allows', async () => {
    const page = async (query: string) =>
      (await http().get(`/api/v1/me/order-history?${query}`).set(bearer(token)).expect(200))
        .body as PagedResult<AccountOrder>;
    const delivered = await page('filter=delivered');
    expect(delivered.items.map((o) => o.number)).toEqual([first.orderNumber]);
    const lamp = delivered.items[0]!;
    expect(lamp.returnableUntil).not.toBeNull();
    expect(lamp.lines[0]).toMatchObject({
      quantity: 2,
      canBuyAgain: true,
      canReview: true,
      productSlug: `arc-desk-lamp-${run}`,
    });
    expect((await page('filter=open')).items.map((o) => o.number)).toEqual([second.orderNumber]);
    expect((await page(`q=warm bulb`)).items.map((o) => o.number)).toEqual([second.orderNumber]);
    expect((await page(`q=${first.orderNumber.toLowerCase()}`)).total).toBe(1);
    expect((await page('filter=returns')).total).toBe(0);
    await http().get('/api/v1/me/order-history?days=7').set(bearer(token)).expect(400);
  });

  it('lists reviews and returns, and stops offering a review once written', async () => {
    await http()
      .post(`/api/v1/catalog/products/arc-desk-lamp-${run}/reviews`)
      .set(bearer(token))
      .send({ rating: 5, title: 'Lovely light', body: 'Warm, even light over the whole desk.' })
      .expect(201);
    const reviews = (await http().get('/api/v1/me/reviews').set(bearer(token)).expect(200)).body;
    expect(reviews[0]).toMatchObject({
      rating: 5,
      verifiedPurchase: true,
      product: { slug: `arc-desk-lamp-${run}` },
    });

    const order = (await http().get(`/api/v1/me/orders/${first.orderNumber}`).set(bearer(token)))
      .body;
    await http()
      .post(`/api/v1/orders/${first.orderNumber}/returns`)
      .set(bearer(token))
      .send({
        reason: 'NO_LONGER_NEEDED',
        items: [{ orderItemId: order.items[0].id, quantity: 1 }],
      })
      .expect(201);
    const returns = (await http().get('/api/v1/me/returns').set(bearer(token)).expect(200)).body;
    expect(returns).toHaveLength(1);

    const history = (
      await http().get('/api/v1/me/order-history?filter=returns').set(bearer(token)).expect(200)
    ).body as PagedResult<AccountOrder>;
    expect(history.items[0]).toMatchObject({ number: first.orderNumber, openReturns: 1 });
    expect(history.items[0]!.lines[0]!.canReview).toBe(false);
    const overview = (await http().get('/api/v1/me/overview').set(bearer(token))).body;
    expect(overview.counts).toMatchObject({ toReview: 0, reviews: 1, openReturns: 1 });
  });

  it('saves communication preferences', async () => {
    expect((await http().get('/api/v1/me/preferences').set(bearer(token))).body).toEqual({
      marketingEmails: false,
      reviewRequests: true,
    });
    await http()
      .put('/api/v1/me/preferences')
      .set(bearer(token))
      .send({ marketingEmails: true, reviewRequests: false })
      .expect(200);
    expect((await http().get('/api/v1/me/preferences').set(bearer(token))).body).toEqual({
      marketingEmails: true,
      reviewRequests: false,
    });
  });

  it('exports the customer’s data as a JSON file', async () => {
    const res = await http().get('/api/v1/me/export').set(bearer(token)).expect(200);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="nixzora-account-/);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.body.profile).toMatchObject({ email: `acct-${run}@example.com`, firstName: 'Ada' });
    expect(res.body.orders.map((o: { number: string }) => o.number).sort()).toEqual(
      [first.orderNumber, second.orderNumber].sort(),
    );
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|password_hash|refreshToken/);
  });

  it('shows another customer nothing of this account', async () => {
    const theirs = (await http().get('/api/v1/me/overview').set(bearer(other)).expect(200))
      .body as AccountOverview;
    expect(theirs.counts.orders).toBe(0);
    expect(
      ((await http().get('/api/v1/me/buy-again').set(bearer(other))).body as BuyAgainItem[]).length,
    ).toBe(0);
    await http().get('/api/v1/me/overview').expect(401);
    void lampVariant;
  });
});
