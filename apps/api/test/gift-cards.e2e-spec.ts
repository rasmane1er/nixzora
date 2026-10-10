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
  type GiftBalanceView,
  type OrderView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { MailService } from '../src/modules/notifications/mail.service';
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

describe('Gift cards and the gift balance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const buyerEmail = `gift-buyer-${run}@example.com`;
  const friendEmail = `gift-friend-${run}@example.com`;
  let buyer: string;
  let friend: string;
  let staff: string;
  let variantId: string;
  let code: string;
  let giftOrder: string;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  const pay = async (checkout: CheckoutResponse) => {
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    await app.get(OutboxService).drain();
  };

  const balance = async (token: string) =>
    (
      (await http().get('/api/v1/me/gift-cards').set(bearer(token)).expect(200))
        .body as GiftBalanceView
    ).balanceCents;

  /** A Buy now checkout of `quantity` × $40 for the friend, using the balance. */
  async function shop(quantity: number, status = 201): Promise<CheckoutResponse> {
    const cart = (
      await http()
        .post('/api/v1/cart/buy-now')
        .set(bearer(friend))
        .send({ variantId, quantity })
        .expect(201)
    ).body as Cart;
    return (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(friend))
        .send({
          buyNowId: cart.cartId,
          email: friendEmail,
          shippingAddress: address,
          useGiftBalance: true,
        })
        .expect(status)
    ).body as CheckoutResponse;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    buyer = await signUp(buyerEmail);
    friend = await signUp(friendEmail);
    const staffEmail = `gift-staff-${run}@example.com`;
    staff = await signUp(staffEmail);
    const staffUser = await prisma.user.findUniqueOrThrow({ where: { email: staffEmail } });
    await prisma.userRole.create({
      data: { user: { connect: { id: staffUser.id } }, role: { connect: { key: 'admin' } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(staff)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(staff))
      .send({ code: totp(setup.body.secret) })
      .expect(201);
    const cat = await prisma.category.create({ data: { slug: `giftcat-${run}`, name: 'Gifts' } });
    const product = await prisma.product.create({
      data: {
        slug: `gift-test-${run}`,
        title: `Gift test ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId: cat.id,
        variants: {
          create: [
            {
              sku: `GIFTT-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: 4_000,
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
    await prisma.giftBalanceEntry.deleteMany({
      where: { user: { email: { contains: run } } },
    });
    const orders = await prisma.order.findMany({
      where: { email: { contains: run } },
      select: { id: true },
    });
    await prisma.giftCard.deleteMany({ where: { orderId: { in: orders.map((o) => o.id) } } });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('sells an e-gift card and emails the code once it is paid', async () => {
    await http()
      .post('/api/v1/gift-cards/checkout')
      .set(bearer(buyer))
      .send({
        amountCents: 5_050,
        recipientEmail: friendEmail,
        recipientName: 'Grace',
        senderName: 'Ada',
      })
      .expect(400);
    const checkout = (
      await http()
        .post('/api/v1/gift-cards/checkout')
        .set(bearer(buyer))
        .send({
          amountCents: 10_000,
          recipientEmail: friendEmail,
          recipientName: 'Grace',
          senderName: 'Ada',
          message: 'Happy birthday!',
        })
        .expect(201)
    ).body as CheckoutResponse;
    giftOrder = checkout.orderNumber;
    expect(checkout.payment.amountCents).toBe(10_000);
    expect(mail.lastTo(friendEmail, 'gift-cards.received')).toBeUndefined();

    await pay(checkout);
    const email = mail.lastTo(friendEmail, 'gift-cards.received');
    expect(email?.subject).toContain('Ada');
    expect(email?.text).toContain('Happy birthday!');
    code = email!.data.code!;
    expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(mail.lastTo(buyerEmail, 'gift-cards.sent')).toBeDefined();

    const order = (await http().get(`/api/v1/orders/${giftOrder}`).set(bearer(buyer)).expect(200))
      .body as OrderView;
    expect(order.kind).toBe('GIFT_CARD');
    expect(order.status).toBe('DELIVERED');
    expect(order.giftCards?.[0]).toMatchObject({ status: 'ACTIVE', last4: code.slice(-4) });
    expect(order.returnableUntil).toBeNull();
    await http()
      .post(`/api/v1/orders/${giftOrder}/returns`)
      .set(bearer(buyer))
      .send({
        reason: 'NO_LONGER_NEEDED',
        items: [{ orderItemId: order.items[0]!.id, quantity: 1 }],
      })
      .expect(409);
    // Only a keyed hash is kept.
    const stored = await prisma.giftCard.findFirstOrThrow({
      where: { order: { number: giftOrder } },
    });
    expect(stored.codeHash).not.toContain(code.replace(/-/g, ''));
  });

  it('redeems a code once, whatever its spacing', async () => {
    await http()
      .post('/api/v1/me/gift-cards/redeem')
      .set(bearer(friend))
      .send({ code: 'ABCD-EFGH-JKMN-PQRS' })
      .expect(404);
    const view = (
      await http()
        .post('/api/v1/me/gift-cards/redeem')
        .set(bearer(friend))
        .send({ code: code.toLowerCase().replace(/-/g, ' ') })
        .expect(200)
    ).body as GiftBalanceView;
    expect(view.balanceCents).toBe(10_000);
    expect(view.entries[0]).toMatchObject({ kind: 'REDEEM', amountCents: 10_000 });
    await http().post('/api/v1/me/gift-cards/redeem').set(bearer(buyer)).send({ code }).expect(409);
  });

  it('spends the balance first and charges the card for the rest', async () => {
    const checkout = await shop(3); // $120 + tax, $100 from the balance
    expect(checkout.paid).toBe(false);
    const order = await prisma.order.findUniqueOrThrow({ where: { number: checkout.orderNumber } });
    expect(order.giftBalanceCents).toBe(10_000);
    expect(checkout.payment.amountCents).toBe(order.totalCents - 10_000);
    expect(await balance(friend)).toBe(0);

    // Not paid after all: the balance comes back.
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'canceled' })
      .expect(200);
    expect(await balance(friend)).toBe(10_000);
  });

  it('pays a small order entirely from the balance, and refunds to it', async () => {
    const checkout = await shop(1);
    expect(checkout.paid).toBe(true);
    const order = (
      await http().get(`/api/v1/orders/${checkout.orderNumber}`).set(bearer(friend)).expect(200)
    ).body as OrderView;
    expect(order.status).toBe('PAID');
    expect(order.giftBalanceCents).toBe(order.totalCents);
    const left = 10_000 - order.totalCents;
    expect(await balance(friend)).toBe(left);

    await http()
      .post(`/api/v1/orders/${checkout.orderNumber}/cancel`)
      .set(bearer(friend))
      .expect(200);
    expect(await balance(friend)).toBe(10_000);
  });

  it('splits a refund: card first, then the balance', async () => {
    const checkout = await shop(3);
    await pay(checkout);
    const order = await prisma.order.findUniqueOrThrow({ where: { number: checkout.orderNumber } });
    const cardPart = order.totalCents - 10_000;
    await http()
      .post(`/api/v1/admin/orders/${order.id}/refunds`)
      .set(bearer(staff))
      .send({ amountCents: cardPart + 500, reason: 'Damaged in transit' })
      .expect(200);
    const refunds = await prisma.refund.findMany({
      where: { payment: { orderId: order.id } },
      include: { payment: { select: { provider: true } } },
    });
    expect(refunds.map((r) => [r.payment.provider, r.amountCents]).sort()).toEqual(
      [
        ['FAKE', cardPart],
        ['GIFT_BALANCE', 500],
      ].sort(),
    );
    expect(await balance(friend)).toBe(500);
  });

  it('lets staff credit a balance and find gift cards, and refuses to refund a redeemed card', async () => {
    const friendUser = await prisma.user.findUniqueOrThrow({ where: { email: friendEmail } });
    const credited = (
      await http()
        .post(`/api/v1/admin/users/${friendUser.id}/gift-credit`)
        .set(bearer(staff))
        .send({ amountCents: 1_500, note: 'Sorry about the late parcel' })
        .expect(200)
    ).body as GiftBalanceView;
    expect(credited.balanceCents).toBe(2_000);
    await http()
      .post(`/api/v1/admin/users/${friendUser.id}/gift-credit`)
      .set(bearer(friend))
      .send({ amountCents: 1_500, note: 'Free money' })
      .expect(403);

    const found = await http()
      .get('/api/v1/admin/gift-cards')
      .query({ q: giftOrder })
      .set(bearer(staff))
      .expect(200);
    expect(found.body[0]).toMatchObject({ status: 'REDEEMED', purchaserEmail: buyerEmail });

    const order = await prisma.order.findUniqueOrThrow({ where: { number: giftOrder } });
    await http()
      .post(`/api/v1/admin/orders/${order.id}/refunds`)
      .set(bearer(staff))
      .send({ amountCents: 10_000, reason: 'Changed mind' })
      .expect(409);
  });
});
