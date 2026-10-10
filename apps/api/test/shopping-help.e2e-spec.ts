import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  AuthTokensSchema,
  type Cart,
  type OrderView,
  type ProductDetail,
  type QuestionPage,
  type ReviewPage,
} from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { AlertsService } from '../src/modules/alerts/alerts.service';
import { recordTracking } from '../src/modules/shipping/tracking';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Delivery dates, tracking, reviews, questions and alerts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const slug = `lamp-${run}`;
  let productId: string;
  let variantId: string;
  let buyer: string;
  let shopper: string;
  let buyerId: string;
  let orderNumber: string;

  async function signUp(email: string): Promise<string> {
    const res = await http()
      .post('/api/v1/auth/register')
      .send({
        email,
        password: 'correct horse battery staple',
        firstName: 'Ada',
        lastName: 'Lovelace',
      })
      .expect(201);
    return AuthTokensSchema.parse(res.body).accessToken;
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const cat = await prisma.category.create({ data: { slug: `help-${run}`, name: 'Lamps' } });
    const product = await prisma.product.create({
      data: {
        slug,
        title: `Brass lamp ${run}`,
        description: 'A brass desk lamp.',
        status: 'ACTIVE',
        categoryId: cat.id,
        variants: {
          create: [
            {
              sku: `LAMP-${run}`.toUpperCase(),
              title: 'Brass',
              priceCents: 10_000,
              inventory: { create: { onHand: 5 } },
            },
          ],
        },
      },
      include: { variants: true },
    });
    productId = product.id;
    variantId = product.variants[0]!.id;

    buyer = await signUp(`help-buyer-${run}@example.com`);
    shopper = await signUp(`help-shopper-${run}@example.com`);
    buyerId = (
      await prisma.user.findUniqueOrThrow({ where: { email: `help-buyer-${run}@example.com` } })
    ).id;
    orderNumber = `NX-${run.slice(-6).toUpperCase().padStart(6, '0')}`;
    await prisma.order.create({
      data: {
        number: orderNumber,
        userId: buyerId,
        email: `help-buyer-${run}@example.com`,
        status: 'SHIPPED',
        placedAt: new Date(),
        shippedAt: new Date(),
        trackingCarrier: 'USPS',
        trackingNumber: `9400${run}`,
        subtotalCents: 10_000,
        totalCents: 10_000,
        shippingAddress: {},
        items: {
          create: [
            {
              variantId,
              sku: `LAMP-${run}`.toUpperCase(),
              productTitle: 'Brass lamp',
              variantTitle: 'Brass',
              unitPriceCents: 10_000,
              quantity: 1,
              totalCents: 10_000,
            },
          ],
        },
      },
    });
  }, 60_000);

  afterAll(async () => {
    await prisma.shipmentEvent.deleteMany({ where: { trackingNumber: `9400${run}` } });
    await prisma.shipmentTracker.deleteMany({ where: { trackingNumber: `9400${run}` } });
    await removeTestData(prisma, run);
    await app.close();
  });

  it('promises a delivery window on the product page and in the cart', async () => {
    const detail = (await http().get(`/api/v1/catalog/products/${slug}`).expect(200))
      .body as ProductDetail;
    expect(detail.delivery?.earliest).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(detail.delivery!.latest >= detail.delivery!.earliest).toBe(true);
    const cart = (
      await http().post('/api/v1/cart/items').send({ variantId, quantity: 1 }).expect(201)
    ).body as Cart;
    expect(cart.delivery).toEqual(detail.delivery);
  });

  it('shows carrier scans and the carrier estimate on the order', async () => {
    await recordTracking(prisma, {
      id: `evt-${run}`,
      trackingNumber: `9400${run}`,
      status: 'in_transit',
      carrier: 'USPS',
      estimatedDeliveryAt: new Date('2030-05-07T18:00:00Z'),
      details: [
        {
          status: 'LABEL_CREATED',
          description: 'Label created',
          location: null,
          at: new Date('2030-05-01T10:00:00Z'),
        },
        {
          status: 'IN_TRANSIT',
          description: 'Arrived at facility',
          location: 'Baltimore, MD',
          at: new Date('2030-05-02T10:00:00Z'),
        },
      ],
    });
    // Trackers resend history: nothing is stored twice.
    await recordTracking(prisma, {
      id: `evt2-${run}`,
      trackingNumber: `9400${run}`,
      status: 'in_transit',
      details: [
        {
          status: 'IN_TRANSIT',
          description: 'Arrived at facility',
          location: 'Baltimore, MD',
          at: new Date('2030-05-02T10:00:00Z'),
        },
      ],
    });
    const order = (
      await http().get(`/api/v1/me/orders/${orderNumber}`).set(bearer(buyer)).expect(200)
    ).body as OrderView;
    expect(order.trackingEvents?.map((e) => e.status)).toEqual(['IN_TRANSIT', 'LABEL_CREATED']);
    expect(order.estimatedDelivery).toEqual({ earliest: '2030-05-07', latest: '2030-05-07' });
  });

  it('takes review photos and helpful votes, and sorts by them', async () => {
    await prisma.order.update({
      where: { number: orderNumber },
      data: { status: 'DELIVERED', deliveredAt: new Date() },
    });
    await http()
      .post(`/api/v1/catalog/products/${slug}/reviews`)
      .set(bearer(buyer))
      .send({
        rating: 5,
        title: 'Lovely light',
        body: 'Warm light and a solid brass base, very happy.',
        photoKeys: ['products/2026/10/00000000-0000-0000-0000-000000000000.jpg'],
      })
      .expect(400);
    await http()
      .post(`/api/v1/catalog/products/${slug}/reviews`)
      .set(bearer(buyer))
      .send({
        rating: 5,
        title: 'Lovely light',
        body: 'Warm light and a solid brass base, very happy.',
      })
      .expect(201);
    const review = await prisma.review.update({
      where: { productId_userId: { productId, userId: buyerId } },
      data: { status: 'APPROVED' },
    });
    await prisma.reviewPhoto.create({
      data: { reviewId: review.id, storageKey: `products/2026/10/${run}.jpg` },
    });

    await http()
      .post(`/api/v1/catalog/reviews/${review.id}/helpful`)
      .set(bearer(buyer))
      .send({})
      .expect(403);
    const voted = await http()
      .post(`/api/v1/catalog/reviews/${review.id}/helpful`)
      .set(bearer(shopper))
      .send({})
      .expect(200);
    expect(voted.body).toEqual({ helpfulCount: 1, voted: true });
    await http()
      .post(`/api/v1/catalog/reviews/${review.id}/helpful`)
      .set(bearer(shopper))
      .send({})
      .expect(200);
    const page = (
      await http()
        .get(`/api/v1/catalog/products/${slug}/reviews?sort=helpful&withPhotos=true`)
        .expect(200)
    ).body as ReviewPage;
    expect(page.reviews[0]).toMatchObject({
      helpfulCount: 1,
      photos: [{ url: expect.stringContaining(run) }],
    });
    const mine = await http()
      .get(`/api/v1/catalog/products/${slug}/reviews/mine`)
      .set(bearer(shopper))
      .expect(200);
    expect(mine.body.helpfulVotes).toEqual([review.id]);
    const undo = await http()
      .post(`/api/v1/catalog/reviews/${review.id}/helpful`)
      .set(bearer(shopper))
      .send({ helpful: false })
      .expect(200);
    expect(undo.body.helpfulCount).toBe(0);
  });

  it('lets anyone ask, and only buyers, the store or staff answer', async () => {
    const asked = await http()
      .post(`/api/v1/catalog/products/${slug}/questions`)
      .set(bearer(shopper))
      .send({ body: 'Does it take an LED bulb?' })
      .expect(201);
    await http()
      .post(`/api/v1/catalog/products/${slug}/questions`)
      .set(bearer(shopper))
      .send({ body: 'short' })
      .expect(400);
    await http()
      .post(`/api/v1/catalog/questions/${asked.body.id}/answers`)
      .set(bearer(shopper))
      .send({ body: 'No idea' })
      .expect(403);
    const answered = await http()
      .post(`/api/v1/catalog/questions/${asked.body.id}/answers`)
      .set(bearer(buyer))
      .send({ body: 'Yes, an E26 LED works well.' })
      .expect(201);
    expect(answered.body.answers).toEqual([
      expect.objectContaining({ role: 'BUYER', author: 'Ada L.' }),
    ]);

    const page = (
      await http().get(`/api/v1/catalog/products/${slug}/questions`).set(bearer(buyer)).expect(200)
    ).body as QuestionPage;
    expect(page.total).toBe(1);
    expect(page.canAnswer).toBe(true);
    const searched = (
      await http().get(`/api/v1/catalog/products/${slug}/questions?q=e26`).expect(200)
    ).body as QuestionPage;
    expect(searched.questions.map((q) => q.id)).toEqual([asked.body.id]);
    expect(searched.canAnswer).toBe(false);
  });

  it('alerts when a saved product gets cheaper or comes back in stock, once', async () => {
    const userId = (
      await prisma.user.findUniqueOrThrow({ where: { email: `help-shopper-${run}@example.com` } })
    ).id;
    await prisma.inventoryItem.update({ where: { variantId }, data: { onHand: 0 } });
    await http().put(`/api/v1/me/wishlist/${productId}`).set(bearer(shopper)).expect(204);
    const kinds = (await http().get('/api/v1/me/alerts').set(bearer(shopper)).expect(200)).body as {
      kind: string;
    }[];
    expect(kinds.map((k) => k.kind).sort()).toEqual(['BACK_IN_STOCK', 'PRICE_DROP']);

    const alerts = app.get(AlertsService);
    const mine = () =>
      prisma.productAlert.findMany({ where: { userId }, orderBy: { kind: 'asc' } });
    await alerts.sweep();
    expect((await mine()).length).toBe(2); // still sold out: nothing sent

    await prisma.inventoryItem.update({ where: { variantId }, data: { onHand: 3 } });
    await prisma.productVariant.update({ where: { id: variantId }, data: { priceCents: 8_000 } });
    await alerts.sweep();
    expect((await mine()).map((a) => [a.kind, a.priceCents])).toEqual([['PRICE_DROP', 8_000]]);
    // A 1% drop is not worth a message.
    await prisma.productVariant.update({ where: { id: variantId }, data: { priceCents: 7_950 } });
    await alerts.sweep();
    expect((await mine())[0]?.priceCents).toBe(8_000);
  });
});
