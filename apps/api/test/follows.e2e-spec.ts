import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PUSH_DRIVER = 'log';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type FollowingFeed,
  type FollowStatus,
  type PublicSeller,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { DealsService } from '../src/modules/deals/deals.service';
import { PushService } from '../src/modules/devices/push.service';
import { FollowsService } from '../src/modules/follows/follows.service';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Follow stores (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const handle = `followshop-${run}`;
  const device = `ExponentPushToken[follow-${run}]`;
  let shopper: string;
  let owner: string;
  let sellerId: string;
  let ownerId: string;
  let productId: string;

  const signUp = async (name: string) =>
    AuthTokensSchema.parse(
      (
        await http()
          .post('/api/v1/auth/register')
          .send({
            email: `follow-${name}-${run}@example.com`,
            password: 'correct horse battery staple',
          })
          .expect(201)
      ).body,
    ).accessToken;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    shopper = await signUp('shopper');
    owner = await signUp('owner');
    await http()
      .put('/api/v1/me/devices')
      .set(bearer(shopper))
      .send({ token: device, platform: 'ios' })
      .expect((res) => expect([200, 201, 204]).toContain(res.status));
    const ownerRow = await prisma.user.findUniqueOrThrow({
      where: { email: `follow-owner-${run}@example.com` },
    });
    ownerId = ownerRow.id;
    const seller = await prisma.seller.create({
      data: {
        handle,
        displayName: 'Follow Shop',
        legalName: 'Follow Shop LLC',
        contactEmail: `follow-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: ownerRow.id, role: 'OWNER' } },
      },
    });
    sellerId = seller.id;
    const cat = await prisma.category.create({
      data: { slug: `followcat-${run}`, name: 'Follow' },
    });
    const product = await prisma.product.create({
      data: {
        slug: `follow-mug-${run}`,
        title: `Follow test mug ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId: cat.id,
        sellerId,
        variants: {
          create: {
            sku: `FOLLOW-${run}`.toUpperCase(),
            title: 'Default',
            priceCents: 2_000,
            inventory: { create: { onHand: 10 } },
          },
        },
      },
    });
    productId = product.id;
  }, 60_000);

  afterAll(async () => {
    await prisma.deal.deleteMany({ where: { productId } });
    await removeTestData(prisma, run);
    await app.close();
  });

  const status = async (token?: string) =>
    (
      await (
        token
          ? http().get(`/api/v1/catalog/sellers/${handle}/follow`).set(bearer(token))
          : http().get(`/api/v1/catalog/sellers/${handle}/follow`)
      ).expect(200)
    ).body as FollowStatus;

  it('follows and unfollows a store, and counts followers on the store page', async () => {
    expect(await status()).toEqual({ following: false, notify: false, followers: 0 });
    const followed = (
      await http().put(`/api/v1/me/follows/${handle}`).set(bearer(shopper)).expect(200)
    ).body as FollowStatus;
    expect(followed).toEqual({ following: true, notify: true, followers: 1 });
    // Twice is still once.
    await http().put(`/api/v1/me/follows/${handle}`).set(bearer(shopper)).expect(200);
    const store = (await http().get(`/api/v1/catalog/sellers/${handle}`).expect(200))
      .body as PublicSeller;
    expect(store.followers).toBe(1);
    // A store's own team can't follow it.
    await http().put(`/api/v1/me/follows/${handle}`).set(bearer(owner)).expect(400);
    await http().put('/api/v1/me/follows/no-such-store').set(bearer(shopper)).expect(404);
  });

  it('shows the store’s new listings and live deals on the Following page', async () => {
    const feed = (await http().get('/api/v1/me/following').set(bearer(shopper)).expect(200))
      .body as FollowingFeed;
    expect(feed.stores).toEqual([
      expect.objectContaining({ handle, displayName: 'Follow Shop', notify: true, newCount: 1 }),
    ]);
    expect(feed.newArrivals.map((p) => p.id)).toEqual([productId]);
    expect(feed.newArrivals[0]!.store).toEqual({ handle, displayName: 'Follow Shop' });
    expect(feed.deals).toEqual([]);
  });

  it('pushes once when the store starts a deal, not again the same day', async () => {
    const now = Date.now();
    await prisma.deal.create({
      data: {
        productId,
        kind: 'DAY',
        percentOff: 20,
        startsAt: new Date(now - 1000),
        endsAt: new Date(now + 86_400_000),
        sellerId,
        createdById: ownerId,
      },
    });
    await app.get(DealsService).tick();
    await app.get(OutboxService).drain();
    const pushes = app.get(PushService).sentTo(device);
    expect(pushes).toEqual([
      expect.objectContaining({
        title: 'New deal at Follow Shop',
        body: `Follow test mug ${run}: 20% off for a limited time.`,
        data: { path: `/p/follow-mug-${run}` },
      }),
    ]);
    const feed = (await http().get('/api/v1/me/following').set(bearer(shopper)).expect(200))
      .body as FollowingFeed;
    expect(feed.deals.map((p) => p.id)).toEqual([productId]);

    // Another deal from the same store the same day: no second push.
    const again = await app
      .get(FollowsService)
      .dealStarted({ productId, sellerId, percentOff: 30 });
    expect(again).toBe(0);
    expect(app.get(PushService).sentTo(device)).toHaveLength(1);
  });

  it('turns deal notifications off, and unfollows', async () => {
    const quiet = (
      await http()
        .patch(`/api/v1/me/follows/${handle}`)
        .set(bearer(shopper))
        .send({ notify: false })
        .expect(200)
    ).body as FollowStatus;
    expect(quiet).toMatchObject({ following: true, notify: false });
    const gone = (
      await http().delete(`/api/v1/me/follows/${handle}`).set(bearer(shopper)).expect(200)
    ).body as FollowStatus;
    expect(gone).toEqual({ following: false, notify: false, followers: 0 });
    await http()
      .patch(`/api/v1/me/follows/${handle}`)
      .set(bearer(shopper))
      .send({ notify: true })
      .expect(404);
  });
});
