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
  type OrderView,
  type PaymentCardView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxService } from '../src/modules/outbox/outbox.service';
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

describe('Saved cards, 1-click and cancelling (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let token: string;
  let otherToken: string;
  let variantId: string;
  let card: PaymentCardView;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function buyNow(auth: string, quantity = 1): Promise<string> {
    const cart = (
      await http()
        .post('/api/v1/cart/buy-now')
        .set(bearer(auth))
        .send({ variantId, quantity })
        .expect(201)
    ).body as Cart;
    return cart.cartId!;
  }

  const checkout = async (auth: string, extra: Record<string, unknown>, status = 201) => {
    const buyNowId = await buyNow(auth);
    return (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(auth))
        .send({
          buyNowId,
          email: `cards-${run}@example.com`,
          shippingAddress: address,
          ...extra,
        })
        .expect(status)
    ).body as CheckoutResponse;
  };

  const stock = async () =>
    (await prisma.inventoryItem.findUniqueOrThrow({ where: { variantId } })).onHand;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    token = await signUp(`cards-${run}@example.com`);
    otherToken = await signUp(`cards-other-${run}@example.com`);
    const cat = await prisma.category.create({ data: { slug: `cardcat-${run}`, name: 'Cards' } });
    const product = await prisma.product.create({
      data: {
        slug: `card-test-${run}`,
        title: `Card test ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId: cat.id,
        variants: {
          create: [
            {
              sku: `CARD-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: 12_000,
              inventory: { create: { onHand: 20 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    variantId = product.variants[0]!.id;
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  it('saves a card only when asked, and only for signed-in customers', async () => {
    const guestBuy = await buyNow(token);
    await http()
      .post('/api/v1/checkout')
      .send({
        buyNowId: guestBuy,
        email: `guest-${run}@example.com`,
        shippingAddress: address,
        saveCard: true,
      })
      .expect(400);

    const first = await checkout(token, { saveCard: true });
    expect(first.paid).toBe(false);
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: first.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    const cards = (await http().get('/api/v1/me/payment-cards').set(bearer(token)).expect(200))
      .body as PaymentCardView[];
    expect(cards).toHaveLength(1);
    card = cards[0]!;
    expect(card).toMatchObject({ brand: 'visa', last4: '4242', isDefault: true, expired: false });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `cards-${run}@example.com` },
    });
    expect(user.paymentCustomerId).toMatch(/^fake_cus_/);
  });

  it('pays at once with a saved card (1-click), and lets the customer cancel soon after', async () => {
    const before = await stock();
    const result = await checkout(token, { paymentCardId: card.id });
    expect(result.paid).toBe(true);
    expect(result.paymentProblem).toBeNull();
    expect(await stock()).toBe(before - 1);

    const order = (
      await http().get(`/api/v1/orders/${result.orderNumber}`).set(bearer(token)).expect(200)
    ).body as OrderView;
    expect(order.status).toBe('PAID');
    expect(order.cancellableUntil).toBeTruthy();

    await http()
      .post(`/api/v1/orders/${result.orderNumber}/cancel`)
      .set(bearer(otherToken))
      .expect(404);
    const cancelled = (
      await http()
        .post(`/api/v1/orders/${result.orderNumber}/cancel`)
        .set(bearer(token))
        .expect(200)
    ).body as OrderView;
    expect(cancelled.status).toBe('CANCELLED');
    expect(cancelled.refundedCents).toBe(cancelled.totalCents);
    expect(cancelled.cancellableUntil).toBeNull();
    expect(await stock()).toBe(before);
  });

  it('stops self-service cancelling after 30 minutes', async () => {
    const result = await checkout(token, { paymentCardId: card.id });
    await prisma.order.update({
      where: { number: result.orderNumber },
      data: { placedAt: new Date(Date.now() - 31 * 60_000) },
    });
    const res = await http()
      .post(`/api/v1/orders/${result.orderNumber}/cancel`)
      .set(bearer(token))
      .expect(409);
    expect(res.body.code).toBe('NOT_CANCELLABLE');
    await app.get(OutboxService).drain();
  });

  it("refuses someone else's card, and sends a declined card to the payment form", async () => {
    await checkout(otherToken, { paymentCardId: card.id }, 404);

    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `cards-${run}@example.com` },
    });
    const declining = await prisma.paymentCard.create({
      data: {
        userId: user.id,
        provider: 'FAKE',
        providerMethodId: `fake_pm_decline_${run}`,
        brand: 'mastercard',
        last4: '0002',
        expMonth: 1,
        expYear: 2099,
      },
    });
    const result = await checkout(token, { paymentCardId: declining.id });
    expect(result.paid).toBe(false);
    expect(result.paymentProblem).toMatch(/declined/);
    const order = await prisma.order.findUniqueOrThrow({ where: { number: result.orderNumber } });
    expect(order.status).toBe('PENDING_PAYMENT');

    const expired = await prisma.paymentCard.create({
      data: {
        userId: user.id,
        provider: 'FAKE',
        providerMethodId: `fake_pm_old_${run}`,
        brand: 'visa',
        last4: '1111',
        expMonth: 1,
        expYear: 2020,
      },
    });
    await checkout(token, { paymentCardId: expired.id }, 400);
  });

  it('changes the default and forgets cards', async () => {
    const cards = (await http().get('/api/v1/me/payment-cards').set(bearer(token)).expect(200))
      .body as PaymentCardView[];
    const other = cards.find((c) => c.last4 === '0002')!;
    const after = (
      await http()
        .post(`/api/v1/me/payment-cards/${other.id}/default`)
        .set(bearer(token))
        .expect(200)
    ).body as PaymentCardView[];
    expect(after.find((c) => c.isDefault)?.id).toBe(other.id);
    await http().delete(`/api/v1/me/payment-cards/${other.id}`).set(bearer(otherToken)).expect(404);
    const left = (
      await http().delete(`/api/v1/me/payment-cards/${other.id}`).set(bearer(token)).expect(200)
    ).body as PaymentCardView[];
    expect(left.map((c) => c.id)).not.toContain(other.id);
    expect(left.filter((c) => c.isDefault)).toHaveLength(1);
  });
});
