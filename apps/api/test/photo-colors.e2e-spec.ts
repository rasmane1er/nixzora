import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.PAYMENTS_PROVIDER = 'fake';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema, type ProductDetail } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Photos per color (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  const products: Record<string, { id: string; variantId: string }> = {};
  let ownerToken: string;
  let staffToken: string;

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
        slug: `pc-${key}-${run}`,
        title: `Color test ${key} ${run}`,
        description: 'A test listing.',
        status: 'ACTIVE',
        categoryId,
        sellerId: seller,
        variants: {
          create: Array.from({ length: options }, (_, i) => ({
            sku: `PC-${key}-${i}-${run}`.toUpperCase(),
            title: `Option ${i + 1}`,
            options: { color: ['Sage', 'Black', 'Cosmic Latte'][i]!, size: 'M' },
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
    ownerToken = await signUp(`pc-owner-${run}@example.com`);
    staffToken = await staff(`pc-staff-${run}@example.com`);
    const owner = await prisma.user.findUniqueOrThrow({
      where: { email: `pc-owner-${run}@example.com` },
    });
    const seller = await prisma.seller.create({
      data: {
        handle: `pcshop-${run}`,
        displayName: 'Color Shop',
        legalName: 'Color Shop LLC',
        contactEmail: `pc-owner-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: owner.id, role: 'OWNER' } },
      },
    });
    const cat = await prisma.category.create({ data: { slug: `pccat-${run}`, name: 'Colors' } });
    await product('tee', cat.id, seller.id, 2_000, 3);
    await product('mug', cat.id, null, 1_500);
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  const images: string[] = [];
  const photo = (key: string, imageId: string) =>
    `/api/v1/seller/products/${products[key]!.id}/images/${imageId}`;

  beforeAll(async () => {
    for (const position of [0, 1, 2]) {
      const image = await prisma.productImage.create({
        data: {
          productId: products.tee!.id,
          storageKey: `products/test/${run}-${position}.jpg`,
          alt: 'Tee',
          position,
        },
      });
      images.push(image.id);
    }
  });

  it("tags a photo with one of the product's colors, and only those", async () => {
    await http()
      .patch(photo('tee', images[1]!))
      .set(bearer(ownerToken))
      .send({ color: 'Purple' })
      .expect(400);
    const detail = (
      await http()
        .patch(photo('tee', images[1]!))
        .set(bearer(ownerToken))
        .send({ color: 'Black' })
        .expect(200)
    ).body as ProductDetail;
    expect(detail.images.map((i) => i.color)).toEqual([null, 'Black', null]);
    // Tagging is not new content: a live listing stays live.
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: products.tee!.id } })).status,
    ).toBe('ACTIVE');
    // Not another store's product, nor a photo of another product.
    await http()
      .patch(`/api/v1/seller/products/${products.mug!.id}/images/${images[0]}`)
      .set(bearer(ownerToken))
      .send({ color: 'Black' })
      .expect(404);
  });

  it('shows the colors as swatches, with their photo when they have one', async () => {
    const detail = (await http().get(`/api/v1/catalog/products/pc-tee-${run}`).expect(200))
      .body as ProductDetail;
    expect(detail.colors).toEqual([
      { name: 'Sage', swatch: '#9cae93', imageUrl: null },
      { name: 'Black', swatch: '#1b1b1f', imageUrl: expect.stringContaining(`${run}-1.jpg`) },
      { name: 'Cosmic Latte', swatch: null, imageUrl: null },
    ]);
    // A single-color product has no swatches.
    const mug = (await http().get(`/api/v1/catalog/products/pc-mug-${run}`).expect(200))
      .body as ProductDetail;
    expect(mug.colors).toBeUndefined();
  });

  it('lets staff tag any photo, and untag it', async () => {
    const detail = (
      await http()
        .patch(`/api/v1/admin/products/${products.tee!.id}/images/${images[1]}`)
        .set(bearer(staffToken))
        .send({ color: null })
        .expect(200)
    ).body as ProductDetail;
    expect(detail.images[1]?.color).toBeNull();
  });
});
