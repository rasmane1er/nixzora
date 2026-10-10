import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type SellerAdsOverview,
  SponsoredProductsSchema,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { settleAdSpend } from '../src/modules/advertising/ad-billing';
import { utcDay } from '../src/modules/advertising/ads.service';
import { totp } from '../src/modules/identity/services/totp';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Sponsored products (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const visitor = (n: number) => `adv-${run}-${n}`.padEnd(20, 'x');
  const category = `adcat-${run}`;
  const ids: Record<string, string> = {};

  let ownerToken: string;
  let staffToken: string;
  let sellerId: string;
  let otherSellerProduct: string;
  let campaignA: string;
  let campaignB: string;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({ email, password: 'correct horse battery staple' })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  async function staff(email: string): Promise<string> {
    const token = await signUp(email);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.userRole.create({
      data: { user: { connect: { id: user.id } }, role: { connect: { key: 'admin' } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(token)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(token))
      .send({ code: totp(setup.body.secret) })
      .expect(201);
    return token;
  }

  async function product(key: string, title: string, categoryId: string, seller: string | null) {
    const created = await prisma.product.create({
      data: {
        slug: `${key}-${run}`,
        title: `${title} ${run}`,
        description: `${title}, a test listing.`,
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: [
            {
              sku: `${key}-${run}`.toUpperCase(),
              title: 'Standard',
              priceCents: 4_900,
              inventory: { create: { onHand: 5 } },
            },
          ],
        },
      },
    });
    ids[key] = created.id;
    await prisma.outboxEvent.create({
      data: {
        aggregateType: 'product',
        aggregateId: created.id,
        type: 'catalog.product.created',
        payload: { productId: created.id },
      },
    });
  }

  const ads = async (query: Record<string, string>) =>
    SponsoredProductsSchema.parse((await http().get('/api/v1/ads').query(query).expect(200)).body)
      .ads;
  const click = (token: string, visitorId?: string, auth?: string) =>
    http()
      .post('/api/v1/ads/clicks')
      .set(auth ? bearer(auth) : {})
      .send({ token, ...(visitorId ? { visitorId } : {}) })
      .expect(200);
  const clickCosts = async () =>
    (await prisma.adClick.findMany({ where: { sellerId }, orderBy: { createdAt: 'asc' } })).map(
      (c) => c.costCents,
    );

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    ownerToken = await signUp(`ads-owner-${run}@example.com`);
    staffToken = await staff(`ads-staff-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `ads-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `adshop-${run}`,
        displayName: 'Ad Shop',
        legalName: 'Ad Shop LLC',
        contactEmail: `ads-owner-${run}@example.com`,
        status: 'ACTIVE',
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    sellerId = seller.id;
    const other = await prisma.seller.create({
      data: {
        handle: `othershop-${run}`,
        displayName: 'Other Shop',
        legalName: 'Other Shop LLC',
        contactEmail: `other-${run}@example.com`,
        status: 'ACTIVE',
      },
    });
    const cat = await prisma.category.create({ data: { slug: category, name: 'Ad tests' } });
    await product('lamp', 'Brass desk lamp', cat.id, seller.id);
    await product('fan', 'Quiet desk fan', cat.id, seller.id);
    await product('house', 'House brand desk lamp', cat.id, null);
    await product('rival', 'Rival desk lamp', cat.id, other.id);
    otherSellerProduct = ids.rival!;
    await app.get(OutboxService).drain();
  }, 60_000);

  afterAll(async () => {
    await prisma.shopperInterest.deleteMany({ where: { visitorId: { startsWith: `adv-${run}` } } });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('lets a seller promote only its own live listings', async () => {
    await http()
      .post('/api/v1/seller/ads/campaigns')
      .set(bearer(ownerToken))
      .send({
        name: 'Not mine',
        productIds: [otherSellerProduct],
        dailyBudgetCents: 500,
        bidCents: 50,
      })
      .expect(400);

    const a = await http()
      .post('/api/v1/seller/ads/campaigns')
      .set(bearer(ownerToken))
      .send({ name: 'Lamps', productIds: [ids.lamp], dailyBudgetCents: 500, bidCents: 100 })
      .expect(201);
    campaignA = a.body.id;
    const b = await http()
      .post('/api/v1/seller/ads/campaigns')
      .set(bearer(ownerToken))
      .send({ name: 'Fans', productIds: [ids.fan], dailyBudgetCents: 500, bidCents: 50 })
      .expect(201);
    campaignB = b.body.id;
    expect(a.body.status).toBe('ACTIVE');
  });

  it('shows no ads until the store can pay for a click', async () => {
    expect(await ads({ placement: 'category', category })).toEqual([]);

    await http()
      .post(`/api/v1/admin/ads/sellers/${sellerId}/credit`)
      .set(bearer(staffToken))
      .send({ amountCents: 1000, note: 'Welcome credit' })
      .expect(200);
    const shown = await ads({ placement: 'category', category });
    expect(shown.map((ad) => ad.product.id)).toEqual([ids.lamp, ids.fan]);
  });

  it('matches searches, never shows unrelated products, and counts impressions', async () => {
    const lamp = await ads({ placement: 'search', q: `brass desk lamp ${run}` });
    expect(lamp.map((ad) => ad.product.id)).toContain(ids.lamp);
    expect(lamp.map((ad) => ad.product.id)).not.toContain(ids.house);
    expect(await ads({ placement: 'search', q: 'cast iron skillet zzz' })).toEqual([]);
    const stats = await prisma.adDailyStat.findMany({ where: { campaignId: campaignA } });
    expect(stats.reduce((n, s) => n + s.impressions, 0)).toBeGreaterThanOrEqual(2);
  });

  it('charges the second price once per shopper, and never the store itself', async () => {
    const [first, second] = await ads({ placement: 'category', category });
    // Lamp (bid 100) only had to beat the fan (bid 50): it pays 51. The fan pays the reserve.
    const res = await click(first!.token, visitor(1));
    expect(res.body).toEqual({ slug: `lamp-${run}` });
    await click(first!.token, visitor(1)); // repeat: free
    await click(second!.token, visitor(1));
    await click(first!.token, undefined, ownerToken); // the store's own team: not charged
    await click(first!.token); // nobody to tell apart: not charged
    expect(await clickCosts()).toEqual([51, 0, 10]);

    await http()
      .post('/api/v1/ads/clicks')
      .send({ token: `${first!.token}x`, visitorId: visitor(2) })
      .expect(400);
  });

  it('stops showing a campaign once its daily budget is spent', async () => {
    await prisma.adDailyStat.update({
      where: {
        campaignId_productId_day: {
          campaignId: campaignB,
          productId: ids.fan!,
          day: new Date(`${utcDay()}T00:00:00Z`),
        },
      },
      data: { spendCents: 495 },
    });
    expect((await ads({ placement: 'category', category })).map((ad) => ad.product.id)).toEqual([
      ids.lamp,
    ]);
  });

  it('bills clicks to ad credit first, then to earnings', async () => {
    await prisma.seller.update({ where: { id: sellerId }, data: { adCreditCents: 30 } });
    const result = await settleAdSpend(prisma, sellerId);
    expect(result).toEqual({ clicks: 2, creditUsedCents: 30, chargedCents: 31 });
    const ledger = await prisma.sellerLedgerEntry.findMany({ where: { sellerId } });
    expect(ledger.map((e) => [e.type, e.amountCents])).toEqual([['AD_SPEND', -31]]);
    expect(await prisma.adClick.count({ where: { sellerId, billedAt: null } })).toBe(0);
    // Nothing left to bill: settling again changes nothing.
    expect(await settleAdSpend(prisma, sellerId)).toEqual({
      clicks: 0,
      creditUsedCents: 0,
      chargedCents: 0,
    });

    const overview = (await http().get('/api/v1/seller/ads').set(bearer(ownerToken)).expect(200))
      .body as SellerAdsOverview;
    expect(overview.creditCents).toBe(0);
    expect(overview.fundsCents).toBe(-31);
    expect(overview.campaigns.find((c) => c.id === campaignA)?.today.spendCents).toBe(51);
    expect(overview.daily).toHaveLength(14);
  });

  it('lets staff suspend a campaign, which the seller cannot resume', async () => {
    await prisma.seller.update({ where: { id: sellerId }, data: { adCreditCents: 1000 } });
    await http()
      .post(`/api/v1/admin/ads/campaigns/${campaignA}/suspend`)
      .set(bearer(staffToken))
      .send({ reason: 'Misleading product title' })
      .expect(200);
    expect(await ads({ placement: 'category', category })).toEqual([]);
    await http()
      .patch(`/api/v1/seller/ads/campaigns/${campaignA}`)
      .set(bearer(ownerToken))
      .send({ status: 'ACTIVE' })
      .expect(409);

    const restored = await http()
      .post(`/api/v1/admin/ads/campaigns/${campaignA}/restore`)
      .set(bearer(staffToken))
      .expect(200);
    expect(restored.body.status).toBe('PAUSED');
    await http()
      .patch(`/api/v1/seller/ads/campaigns/${campaignA}`)
      .set(bearer(ownerToken))
      .send({ status: 'ACTIVE' })
      .expect(200);
    expect((await ads({ placement: 'category', category })).map((ad) => ad.product.id)).toEqual([
      ids.lamp,
    ]);
  });
});
