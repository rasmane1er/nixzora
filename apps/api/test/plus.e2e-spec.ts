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
  type DealsPage,
  type MyPlus,
  type PlusJoinResult,
  type PlusOffer,
  type ProductDetail,
  twoDayWindow,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { MailService } from '../src/modules/notifications/mail.service';
import { orderInclude } from '../src/modules/orders/order-links';
import { RefundsService } from '../src/modules/orders/refunds.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { addMonths, PlusService } from '../src/modules/plus/plus.service';
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

describe('NIXZORA Plus (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mail: MailService;
  let plus: PlusService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const email = `plus-${run}@example.com`;
  const otherEmail = `plus-other-${run}@example.com`;
  let member: string;
  let other: string;
  const variants: Record<string, string> = {};
  const products: Record<string, string> = {};

  async function signUp(address: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email: address, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function product(key: string, priceCents: number, categoryId: string) {
    const created = await prisma.product.create({
      data: {
        slug: `plus-${key}-${run}`,
        title: `Plus test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        variants: {
          create: [
            {
              sku: `PLUS-${key}-${run}`.toUpperCase(),
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

  const buyNow = async (token: string, key: string) =>
    (
      await http()
        .post('/api/v1/cart/buy-now')
        .set(bearer(token))
        .send({ variantId: variants[key], quantity: 1 })
        .expect(201)
    ).body as Cart;
  const cartOf = async (token: string, id: string) =>
    (await http().get(`/api/v1/cart/buy-now/${id}`).set(bearer(token)).expect(200)).body as Cart;
  const mine = async (token = member) =>
    (await http().get('/api/v1/me/plus').set(bearer(token)).expect(200)).body as MyPlus;
  const membership = (address = email) =>
    prisma.plusMembership.findFirstOrThrow({ where: { user: { email: address } } });
  const confirm = (clientSecret: string, outcome = 'succeeded') =>
    http().post('/api/v1/payments/fake/confirm').send({ clientSecret, outcome }).expect(200);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    mail = app.get(MailService);
    plus = app.get(PlusService);
    member = await signUp(email);
    other = await signUp(otherEmail);
    const cat = await prisma.category.create({ data: { slug: `pluscat-${run}`, name: 'Plus' } });
    await product('mug', 2_000, cat.id);
    await product('lamp', 5_000, cat.id);
    await product('kettle', 4_000, cat.id);

    // A saved card, from a first purchase.
    const cart = await buyNow(member, 'mug');
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(member))
        .send({ buyNowId: cart.cartId, email, shippingAddress: address, saveCard: true })
        .expect(201)
    ).body as CheckoutResponse;
    await confirm(checkout.payment.clientSecret);
    await app.get(OutboxService).drain();
  }, 60_000);

  afterAll(async () => {
    await prisma.deal.deleteMany({ where: { productId: { in: Object.values(products) } } });
    await prisma.order.updateMany({
      where: { user: { email: { contains: run } } },
      data: { plusMembershipId: null },
    });
    await prisma.plusMembership.deleteMany({ where: { user: { email: { contains: run } } } });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('shows the plans and the free trial to anyone', async () => {
    const offer = (await http().get('/api/v1/plus').expect(200)).body as PlusOffer;
    expect(offer.plans).toEqual([
      { plan: 'MONTHLY', priceCents: 799, months: 1 },
      { plan: 'YEARLY', priceCents: 7_900, months: 12 },
    ]);
    expect(offer).toMatchObject({ trialDays: 30, trialAvailable: null });
    expect((await mine()).offer.trialAvailable).toBe(true);
    expect((await mine()).membership).toBeNull();
  });

  it('starts a free 30-day trial, with the renewal terms in writing', async () => {
    const before = await buyNow(member, 'mug');
    expect(before.totals.shippingCents).toBe(999);

    const joined = (
      await http().post('/api/v1/me/plus').set(bearer(member)).send({ plan: 'MONTHLY' }).expect(201)
    ).body as PlusJoinResult;
    expect(joined.checkout).toBeNull();
    expect(joined.membership).toMatchObject({
      plan: 'MONTHLY',
      status: 'TRIALING',
      active: true,
      trial: true,
      cancelAtPeriodEnd: false,
      nextCharge: { amountCents: 799 },
      card: { last4: '4242' },
    });
    const days = (Date.parse(joined.membership!.currentPeriodEnd) - Date.now()) / DAY;
    expect(Math.round(days)).toBe(30);
    const welcome = mail.lastTo(email, 'plus.trial')?.text;
    expect(welcome).toContain('$7.99');
    expect(welcome).toContain('•••• 4242');
    expect(welcome).toContain('Cancel before');
    // Once a member, not twice.
    await http().post('/api/v1/me/plus').set(bearer(member)).send({ plan: 'YEARLY' }).expect(409);
  });

  it('gives members free shipping, and 2-day delivery on what NIXZORA ships', async () => {
    const cart = await cartOf(member, (await buyNow(member, 'mug')).cartId!);
    expect(cart.totals).toMatchObject({
      shippingCents: 0,
      shippingWaivedCents: 999,
      shippingSpeed: 'TWO_DAY',
      freeShippingRemainingCents: 0,
      totalCents: 2_000 + cart.totals.taxCents,
    });
    expect(cart.delivery).toEqual(twoDayWindow(new Date()));
    // Not for everyone else.
    const theirs = await cartOf(other, (await buyNow(other, 'mug')).cartId!);
    expect(theirs.totals.shippingCents).toBe(999);
    expect(theirs.totals.shippingWaivedCents).toBeUndefined();
  });

  it('prices member-only deals for members, and opens lightning deals to them early', async () => {
    const creator = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.deal.create({
      data: {
        productId: products.lamp!,
        kind: 'DAY',
        audience: 'PLUS',
        percentOff: 20,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + DAY),
        status: 'LIVE',
        createdById: creator.id,
      },
    });
    await prisma.deal.create({
      data: {
        productId: products.kettle!,
        kind: 'LIGHTNING',
        percentOff: 25,
        startsAt: new Date(Date.now() + 10 * 60_000),
        endsAt: new Date(Date.now() + 4 * 3_600_000),
        quantity: 5,
        createdById: creator.id,
      },
    });
    const lamp = (await cartOf(member, (await buyNow(member, 'lamp')).cartId!)).lines[0]!;
    expect(lamp).toMatchObject({ unitPriceCents: 4_000, regularPriceCents: 5_000 });
    const kettle = (await cartOf(member, (await buyNow(member, 'kettle')).cartId!)).lines[0]!;
    expect(kettle).toMatchObject({ unitPriceCents: 3_000, regularPriceCents: 4_000 });
    const theirLamp = (await cartOf(other, (await buyNow(other, 'lamp')).cartId!)).lines[0]!;
    expect(theirLamp.unitPriceCents).toBe(5_000);
    expect(theirLamp.regularPriceCents).toBeUndefined();

    // The listed price stays; the card says the deal is for members.
    const detail = (await http().get(`/api/v1/catalog/products/plus-lamp-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.priceFromCents).toBe(5_000);
    expect(detail.deal).toMatchObject({ percentOff: 20, plusOnly: true });
    const page = (await http().get(`/api/v1/catalog/deals?category=pluscat-${run}`).expect(200))
      .body as DealsPage;
    expect(page.upcoming.find((u) => u.product.id === products.kettle)?.earlyAccess).toBe(true);
  });

  it('records what Plus saved on an order, and ships it 2-day', async () => {
    const cart = await buyNow(member, 'lamp');
    const card = await prisma.paymentCard.findFirstOrThrow({ where: { user: { email } } });
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(member))
        .send({ buyNowId: cart.cartId, email, shippingAddress: address, paymentCardId: card.id })
        .expect(201)
    ).body as CheckoutResponse;
    expect(checkout.paid).toBe(true);
    const order = await prisma.order.findUniqueOrThrow({ where: { id: checkout.orderId } });
    // $40 at the member price: under the $99 free-shipping line, so Plus saved the $9.99 too.
    expect(order).toMatchObject({
      subtotalCents: 4_000,
      shippingCents: 0,
      shippingSpeed: 'TWO_DAY',
      shippingWaivedCents: 999,
      plusSavingsCents: 999 + 1_000,
    });
  });

  it('turns the trial into a paid month on the saved card when it ends', async () => {
    const trial = await membership();
    await prisma.plusMembership.update({
      where: { id: trial.id },
      data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
    });
    const ended = (await membership()).currentPeriodEnd;
    const result = await plus.sweep();
    expect(result.charged).toBe(1);
    const row = await membership();
    expect(row).toMatchObject({ status: 'ACTIVE', failedAttempts: 0 });
    expect(row.currentPeriodEnd.getTime()).toBe(addMonths(ended, 1).getTime());
    const fee = await prisma.order.findFirstOrThrow({
      where: { plusMembershipId: row.id, kind: 'PLUS' },
      include: orderInclude,
    });
    expect(fee).toMatchObject({ status: 'DELIVERED', totalCents: 799, shippingCents: 0 });
    expect(fee.items[0]).toMatchObject({ sku: 'PLUS-MONTHLY', productTitle: 'NIXZORA Plus' });
    expect(mail.lastTo(email, 'plus.joined')?.text).toContain('$7.99');
    // Not charged twice.
    expect((await plus.sweep()).charged).toBe(0);

    // The next month is a renewal.
    await prisma.plusMembership.update({
      where: { id: row.id },
      data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
    });
    expect((await plus.sweep()).charged).toBe(1);
    expect(mail.lastTo(email, 'plus.renewed')?.text).toContain('another month');
    expect((await mine()).membership?.savedCents).toBeGreaterThan(0);
  });

  it('keeps benefits for 3 days when a renewal is declined, then ends', async () => {
    await prisma.paymentCard.updateMany({
      where: { user: { email } },
      data: { providerMethodId: `fake_pm_decline_${run}` },
    });
    const row = await membership();
    await prisma.plusMembership.update({
      where: { id: row.id },
      data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
    });
    expect((await plus.sweep()).charged).toBe(0);
    const view = (await mine()).membership!;
    expect(view).toMatchObject({ status: 'PAST_DUE', active: true });
    expect(view.unpaidOrderNumber).toMatch(/^NX-/);
    expect(mail.lastTo(email, 'plus.failed')?.text).toContain(
      `/checkout/pay/${view.unpaidOrderNumber}`,
    );
    // Still a member while it's retried.
    const cart = await cartOf(member, (await buyNow(member, 'mug')).cartId!);
    expect(cart.totals.shippingCents).toBe(0);

    // The grace period runs out.
    await prisma.plusMembership.update({
      where: { id: row.id },
      data: { currentPeriodEnd: new Date(Date.now() - 4 * DAY) },
    });
    expect((await plus.sweep()).ended).toBe(1);
    expect((await membership()).status).toBe('ENDED');
    expect(mail.lastTo(email, 'plus.ended')).toBeDefined();
    const unpaid = await prisma.order.findUniqueOrThrow({
      where: { number: view.unpaidOrderNumber! },
    });
    expect(unpaid.status).toBe('CANCELLED');
    expect((await mine()).membership).toBeNull();
    const after = await cartOf(member, (await buyNow(member, 'mug')).cartId!);
    expect(after.totals.shippingCents).toBe(999);
  });

  it('charges a returning member at once (one trial per customer)', async () => {
    expect((await mine()).offer.trialAvailable).toBe(false);
    const joined = (
      await http().post('/api/v1/me/plus').set(bearer(member)).send({ plan: 'YEARLY' }).expect(201)
    ).body as PlusJoinResult;
    expect(joined.membership).toBeNull();
    expect(joined.checkout?.paid).toBe(false);
    expect(joined.checkout?.totals.totalCents).toBe(7_900);
    await confirm(joined.checkout!.payment.clientSecret);
    await app.get(OutboxService).drain();
    const row = await membership();
    expect(row).toMatchObject({ status: 'ACTIVE', plan: 'YEARLY' });
    expect(Math.round((row.currentPeriodEnd.getTime() - Date.now()) / DAY)).toBeGreaterThan(360);
    expect(mail.lastTo(email, 'plus.joined')?.text).toContain('$79.00');
  });

  it('reminds before a yearly renewal, once', async () => {
    const row = await membership();
    await prisma.plusMembership.update({
      where: { id: row.id },
      data: { currentPeriodEnd: new Date(Date.now() + 2 * DAY) },
    });
    expect((await plus.sweep()).reminded).toBe(1);
    expect(mail.lastTo(email, 'plus.reminder')?.text).toContain('$79.00 a year');
    expect((await plus.sweep()).reminded).toBe(0);
  });

  it('lets a member leave at the end of the period, or change their mind', async () => {
    let res = (
      await http()
        .patch('/api/v1/me/plus')
        .set(bearer(member))
        .send({ cancelAtPeriodEnd: true })
        .expect(200)
    ).body as MyPlus;
    expect(res.membership).toMatchObject({
      cancelAtPeriodEnd: true,
      active: true,
      nextCharge: null,
    });
    expect(mail.lastTo(email, 'plus.leaving')).toBeDefined();
    res = (
      await http()
        .patch('/api/v1/me/plus')
        .set(bearer(member))
        .send({ cancelAtPeriodEnd: false, plan: 'MONTHLY' })
        .expect(200)
    ).body as MyPlus;
    expect(res.membership).toMatchObject({
      cancelAtPeriodEnd: false,
      plan: 'MONTHLY',
      nextCharge: { amountCents: 799 },
    });

    // Leaving for real: it ends when the period does, without a charge.
    await http()
      .patch('/api/v1/me/plus')
      .set(bearer(member))
      .send({ cancelAtPeriodEnd: true })
      .expect(200);
    const row = await membership();
    await prisma.plusMembership.update({
      where: { id: row.id },
      data: { currentPeriodEnd: new Date(Date.now() - 60_000) },
    });
    const swept = await plus.sweep();
    expect(swept).toMatchObject({ ended: 1, charged: 0 });
    expect((await membership()).status).toBe('ENDED');
  });

  it('ends the membership when its fee is refunded in full', async () => {
    // Rejoin on the (working again) saved card, paid at once.
    // (Rejoining saved a second card; each gets a working test method again.)
    const cards = await prisma.paymentCard.findMany({ where: { user: { email } } });
    for (const [i, c] of cards.entries()) {
      await prisma.paymentCard.update({
        where: { id: c.id },
        data: { providerMethodId: `fake_pm_ok_${i}_${run}` },
      });
    }
    const card = await prisma.paymentCard.findFirstOrThrow({ where: { user: { email } } });
    const joined = (
      await http()
        .post('/api/v1/me/plus')
        .set(bearer(member))
        .send({ plan: 'MONTHLY', paymentCardId: card.id })
        .expect(201)
    ).body as PlusJoinResult;
    expect(joined.checkout?.paid).toBe(true);
    expect(joined.membership?.status).toBe('ACTIVE');
    const fee = await prisma.order.findUniqueOrThrow({
      where: { number: joined.checkout!.orderNumber },
      include: orderInclude,
    });
    await app.get(RefundsService).refund(fee, fee.totalCents, 'Support goodwill');
    expect((await membership()).status).toBe('ENDED');
  });

  it('gives Ops the members and the monthly revenue', async () => {
    const overview = await plus.overview({ q: run });
    expect(overview.members.map((m) => m.email)).toContain(email);
    expect(overview.counts.ENDED).toBeGreaterThanOrEqual(1);
  });
});
