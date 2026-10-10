import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';
process.env.VIDEO_LOOKUP = 'off';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema, type ProductDetail } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Product videos (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const products: Record<string, { id: string; variantId: string }> = {};
  let ownerToken: string;
  let staffToken: string;
  let otherToken: string;

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

  async function product(
    key: string,
    categoryId: string,
    seller: string | null,
    priceCents: number,
    options = 1,
  ) {
    const created = await prisma.product.create({
      data: {
        slug: `vid-${key}-${run}`,
        title: `Video test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: Array.from({ length: options }, (_, i) => ({
            sku: `VID-${key}-${i}-${run}`.toUpperCase(),
            title: `Option ${i + 1}`,
            priceCents,
            inventory: { create: { onHand: 20 } },
          })),
        },
      },
      include: { variants: true },
    });
    products[key] = { id: created.id, variantId: created.variants[0]!.id };
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false, rawBody: true });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    ownerToken = await signUp(`vid-owner-${run}@example.com`);
    staffToken = await staff(`vid-staff-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `vid-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `vidshop-${run}`,
        displayName: 'Video Shop',
        legalName: 'Video Shop LLC',
        contactEmail: `vid-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    const cat = await prisma.category.create({ data: { slug: `vidcat-${run}`, name: 'Videos' } });
    await product('tee', cat.id, seller.id, 2_000, 3);
    await product('mug', cat.id, null, 1_500);
    otherToken = await signUp(`vid-other-${run}@example.com`);
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const videos = (key: string) => `/api/v1/seller/products/${products[key]!.id}/videos`;

  it('adds YouTube and Vimeo links to a store’s own listing, up to three', async () => {
    const add = (token: string, url: string, status: number, title?: string) =>
      http().post(videos('tee')).set(bearer(token)).send({ url, title }).expect(status);
    await add(ownerToken, 'https://example.com/clip.mp4', 400);
    await add(otherToken, 'https://youtu.be/dQw4w9WgXcQ', 403);
    const first = (await add(ownerToken, 'https://youtu.be/dQw4w9WgXcQ', 201, 'Unboxing'))
      .body as ProductDetail;
    expect(first.videos).toEqual([
      expect.objectContaining({
        provider: 'YOUTUBE',
        videoId: 'dQw4w9WgXcQ',
        title: 'Unboxing',
        thumbnailUrl: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        embedUrl: expect.stringContaining('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ'),
      }),
    ]);
    // The same video twice.
    await add(ownerToken, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', 409);
    await add(ownerToken, 'https://vimeo.com/76979871/a1b2c3d4e5', 201);
    await add(ownerToken, 'https://www.youtube.com/shorts/aaaaaaaaaaa', 201);
    await add(ownerToken, 'https://www.youtube.com/shorts/bbbbbbbbbbb', 409);
  });

  it('sends a live listing back to review, then shows the videos to shoppers', async () => {
    await prisma.product.update({ where: { id: products.tee!.id }, data: { status: 'ACTIVE' } });
    const added = (
      await http()
        .delete(
          `${videos('tee')}/${(await prisma.productVideo.findFirstOrThrow({ where: { productId: products.tee!.id, provider: 'VIMEO' } })).id}`,
        )
        .set(bearer(ownerToken))
        .expect(200)
    ).body as ProductDetail;
    expect(added.videos).toHaveLength(2);
    // Removing doesn't need review; adding does.
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: products.tee!.id } })).status,
    ).toBe('ACTIVE');
    await http()
      .post(videos('tee'))
      .set(bearer(ownerToken))
      .send({ url: 'https://vimeo.com/76979871' })
      .expect(201);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: products.tee!.id } })).status,
    ).toBe('PENDING_REVIEW');
    await prisma.product.update({ where: { id: products.tee!.id }, data: { status: 'ACTIVE' } });
    const detail = (await http().get(`/api/v1/catalog/products/vid-tee-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.videos?.map((v) => v.title)).toEqual(['Unboxing', 'Video', 'Video']);
    expect(detail.videos?.[2]).toMatchObject({
      provider: 'VIMEO',
      thumbnailUrl: null,
      embedUrl: 'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1',
    });
  });

  it("lets staff add videos to NIXZORA's products, and not stores to someone else's", async () => {
    await http()
      .post(videos('mug'))
      .set(bearer(ownerToken))
      .send({ url: 'https://youtu.be/dQw4w9WgXcQ' })
      .expect(404);
    const detail = (
      await http()
        .post(`/api/v1/admin/products/${products.mug!.id}/videos`)
        .set(bearer(staffToken))
        .send({ url: 'https://youtu.be/dQw4w9WgXcQ', title: 'Care guide' })
        .expect(201)
    ).body as ProductDetail;
    expect(detail.videos?.[0]?.title).toBe('Care guide');
    await http()
      .delete(`/api/v1/admin/products/${products.mug!.id}/videos/${detail.videos![0]!.id}`)
      .set(bearer(staffToken))
      .expect(200);
  });
});
