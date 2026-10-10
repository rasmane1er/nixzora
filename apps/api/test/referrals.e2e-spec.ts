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
  REFERRAL_REWARD_CENTS,
  type ReferralView,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { ReferralsService } from '../src/modules/referrals/referrals.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

const home = {
  fullName: 'Ada Inviter',
  line1: '1 Main St',
  city: 'Brandywine',
  region: 'MD',
  postalCode: '20613',
  country: 'US',
};
const elsewhere = { ...home, fullName: 'Bea Friend', line1: '22 Oak Ave', postalCode: '20601' };

describe('Refer a friend (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let variantId: string;
  let inviter: string;
  let code: string;

  const signUp = async (name: string, firstName?: string) =>
    AuthTokensSchema.parse(
      (
        await http()
          .post('/api/v1/auth/register')
          .send({
            email: `ref-${name}-${run}@example.com`,
            password: 'correct horse battery staple',
            ...(firstName ? { firstName } : {}),
          })
          .expect(201)
      ).body,
    ).accessToken;

  const me = async (token: string) =>
    (await http().get('/api/v1/me/referral').set(bearer(token)).expect(200)).body as ReferralView;

  /** A paid order, then shipped, as the warehouse would. */
  async function order(token: string, name: string, address: object, coupon?: string) {
    await http()
      .post('/api/v1/cart/items')
      .set(bearer(token))
      .send({ variantId, quantity: 1 })
      .expect(201);
    if (coupon) {
      await http()
        .post('/api/v1/cart/coupon')
        .set(bearer(token))
        .send({ code: coupon })
        .expect(201);
    }
    const checkout = (
      await http()
        .post('/api/v1/checkout')
        .set(bearer(token))
        .send({ email: `ref-${name}-${run}@example.com`, shippingAddress: address })
        .expect(201)
    ).body as CheckoutResponse;
    await http()
      .post('/api/v1/payments/fake/confirm')
      .send({ clientSecret: checkout.payment.clientSecret, outcome: 'succeeded' })
      .expect(200);
    await prisma.order.update({
      where: { id: checkout.orderId },
      data: { status: 'SHIPPED', shippedAt: new Date() },
    });
    await app.get(ReferralsService).settle(checkout.orderId);
    await app.get(OutboxService).drain();
    return checkout;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const cat = await prisma.category.create({ data: { slug: `refcat-${run}`, name: 'Refer' } });
    const product = await prisma.product.create({
      data: {
        slug: `ref-lamp-${run}`,
        title: `Referral test lamp ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId: cat.id,
        variants: {
          create: {
            sku: `REF-${run}`.toUpperCase(),
            title: 'Default',
            priceCents: 4_000,
            inventory: { create: { onHand: 50 } },
          },
        },
      },
      include: { variants: true },
    });
    variantId = product.variants[0]!.id;
    inviter = await signUp('ada', 'Ada');
    // The inviter has shopped before, at home.
    await order(inviter, 'ada', home);
  }, 90_000);

  afterAll(async () => {
    const mine = await prisma.referral.findMany({
      where: { referred: { email: { contains: `-${run}@` } } },
    });
    await prisma.coupon.deleteMany({
      where: { code: { in: mine.map((r) => r.couponCode ?? '') } },
    });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('gives everyone a code and a link, and a public preview with a first name only', async () => {
    const view = await me(inviter);
    code = view.code;
    expect(code).toMatch(/^ADA[A-Z0-9]{4}$/);
    expect(view.link).toMatch(new RegExp(`/r/${code}$`));
    // Their first order is paid: too late to use someone else's code.
    expect(view.canClaim).toBe(false);
    expect((await http().get(`/api/v1/referrals/${code.toLowerCase()}`).expect(200)).body).toEqual({
      firstName: 'Ada',
      friendCents: 1000,
      minOrderCents: 2500,
    });
    await http().get('/api/v1/referrals/NOPE000').expect(404);
  });

  it('a new friend claims once, gets a one-time code, and can’t use their own', async () => {
    const bea = await signUp('bea', 'Bea');
    expect((await me(bea)).canClaim).toBe(true);
    const claimed = (
      await http().post('/api/v1/me/referral/claim').set(bearer(bea)).send({ code }).expect(200)
    ).body as ReferralView;
    expect(claimed.welcome).toMatchObject({ amountCents: 1000, used: false });
    expect(claimed.canClaim).toBe(false);
    expect(
      (await http().get('/api/v1/me/referral/welcome').set(bearer(bea)).expect(200)).body.welcome,
    ).toEqual(claimed.welcome);
    await http().post('/api/v1/me/referral/claim').set(bearer(bea)).send({ code }).expect(409);
    await http().post('/api/v1/me/referral/claim').set(bearer(inviter)).send({ code }).expect(400);
    expect((await me(inviter)).invites).toEqual([
      expect.objectContaining({ name: 'Bea', status: 'PENDING' }),
    ]);

    // Bea's first order uses her code and ships: Ada gets credit.
    await order(bea, 'bea', elsewhere, claimed.welcome!.code);
    expect((await me(bea)).welcome?.used).toBe(true);
    const ada = await me(inviter);
    expect(ada).toMatchObject({ rewardedThisYear: 1, earnedCents: REFERRAL_REWARD_CENTS });
    expect(ada.invites[0]).toMatchObject({ status: 'REWARDED' });
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `ref-ada-${run}@example.com` },
    });
    const credit = await prisma.giftBalanceEntry.findMany({
      where: { userId: user.id, kind: 'REFERRAL' },
    });
    expect(credit.map((c) => c.amountCents)).toEqual([REFERRAL_REWARD_CENTS]);

    // Shipped again or delivered later: no second reward.
    const referral = await prisma.referral.findFirstOrThrow({ where: { referrerId: user.id } });
    await app.get(ReferralsService).settle(referral.orderId!);
    expect(
      await prisma.giftBalanceEntry.count({ where: { userId: user.id, kind: 'REFERRAL' } }),
    ).toBe(1);
  });

  it('no reward when the "friend" ships to the inviter’s own door', async () => {
    const cal = await signUp('cal');
    await http().post('/api/v1/me/referral/claim').set(bearer(cal)).send({ code }).expect(200);
    await order(cal, 'cal', { ...home, fullName: 'Cal', line1: '1 main st.' });
    const invite = (await me(inviter)).invites.find((i) => i.status !== 'REWARDED');
    expect(invite).toMatchObject({ status: 'REJECTED', reason: 'SAME_HOUSEHOLD', name: null });
    expect((await me(inviter)).earnedCents).toBe(REFERRAL_REWARD_CENTS);
  });
});
