import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AuthTokensSchema, type ProductDetail, type SizeChartView } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { totp } from '../src/modules/identity/services/totp';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Size & fit guide (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());
  const bearer = (token: string) => ({ Authorization: `Bearer ${token}` });
  let owner: string;
  let other: string;
  let staff: string;
  let shoesId: string;
  let sneaker: { id: string; slug: string };
  let gadgetSlug: string;

  const signUp = async (name: string) =>
    AuthTokensSchema.parse(
      (
        await http()
          .post('/api/v1/auth/register')
          .send({
            email: `size-${name}-${run}@example.com`,
            password: 'correct horse battery staple',
          })
          .expect(201)
      ).body,
    ).accessToken;

  async function store(name: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: `size-${name}-${run}@example.com` },
    });
    return prisma.seller.create({
      data: {
        handle: `size${name}-${run}`,
        displayName: `Size ${name}`,
        legalName: `Size ${name} LLC`,
        contactEmail: `size-${name}-${run}@example.com`,
        status: 'ACTIVE',
        commissionBps: 1000,
        members: { create: { userId: user.id, role: 'OWNER' } },
      },
    });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    owner = await signUp('owner');
    other = await signUp('other');
    staff = await signUp('staff');
    const staffUser = await prisma.user.findUniqueOrThrow({
      where: { email: `size-staff-${run}@example.com` },
    });
    await prisma.userRole.create({
      data: { user: { connect: { id: staffUser.id } }, role: { connect: { key: 'admin' } } },
    });
    const setup = await http().post('/api/v1/me/mfa/setup').set(bearer(staff)).expect(201);
    await http()
      .post('/api/v1/me/mfa/enable')
      .set(bearer(staff))
      .send({ code: totp(setup.body.secret) })
      .expect(201);

    const seller = await store('owner');
    await store('other');
    // A sized department with a shoes category under it, and an unsized one.
    const clothing = await prisma.category.create({
      data: { slug: `clothing-shoes-${run}`, name: 'Clothing test' },
    });
    // Sized means "under clothing-shoes": use the real department when it exists.
    const department =
      (await prisma.category.findUnique({ where: { slug: 'clothing-shoes' } })) ?? clothing;
    const shoes = await prisma.category.create({
      data: { slug: `sizeshoes-${run}`, name: 'Test shoes', parentId: department.id },
    });
    shoesId = shoes.id;
    const gadgets = await prisma.category.create({
      data: { slug: `sizegadgets-${run}`, name: 'Gadgets' },
    });
    const make = (slug: string, categoryId: string) =>
      prisma.product.create({
        data: {
          slug,
          title: `Size test ${slug}`,
          description: 'A test listing.',
          status: 'ACTIVE',
          categoryId,
          sellerId: seller.id,
          variants: {
            create: {
              sku: slug.toUpperCase(),
              title: 'US 9',
              priceCents: 6_000,
              options: { Size: '9' },
              inventory: { create: { onHand: 5 } },
            },
          },
        },
      });
    const shoe = await make(`size-runner-${run}`, shoes.id);
    sneaker = { id: shoe.id, slug: shoe.slug };
    gadgetSlug = (await make(`size-gadget-${run}`, gadgets.id)).slug;
  }, 90_000);

  afterAll(async () => {
    await prisma.sizeChart.deleteMany({ where: { name: { contains: run } } });
    await removeTestData(prisma, run);
    await prisma.category.deleteMany({ where: { slug: { contains: run } } }).catch(() => undefined);
    await app.close();
  });

  const detail = async (slug: string) =>
    (await http().get(`/api/v1/catalog/products/${slug}`).expect(200)).body as ProductDetail;

  it('uses NIXZORA’s default chart for the category, and nothing for unsized products', async () => {
    const created = (
      await http()
        .post('/api/v1/admin/size-charts')
        .set(bearer(staff))
        .send({
          name: `Default shoes ${run}`,
          categoryId: shoesId,
          text: 'Size, EU, Foot (cm)\n8, 41, 26.0\n9, 42.5, 27.0',
          isDefault: true,
        })
        .expect(201)
    ).body as SizeChartView;
    expect(created).toMatchObject({ nixzora: true, isDefault: true, columns: ['EU', 'Foot (cm)'] });
    expect((await detail(sneaker.slug)).sizeGuide?.chart?.name).toBe(`Default shoes ${run}`);
    expect((await detail(gadgetSlug)).sizeGuide).toBeNull();
  });

  it('lets a store write its own chart and attach it, but not another store’s', async () => {
    const mine = (
      await http()
        .post('/api/v1/seller/size-charts')
        .set(bearer(owner))
        .send({
          name: `Runner fit ${run}`,
          categoryId: shoesId,
          text: 'Size\tFoot (cm)\n9\t27.2\n10\t28.1',
          // A store can't set NIXZORA's default.
          isDefault: true,
        })
        .expect(201)
    ).body as SizeChartView;
    expect(mine).toMatchObject({ nixzora: false, isDefault: false });
    const theirs = (
      await http()
        .post('/api/v1/seller/size-charts')
        .set(bearer(other))
        .send({ name: `Other ${run}`, categoryId: shoesId, text: 'Size, Foot (cm)\n9, 27' })
        .expect(201)
    ).body as SizeChartView;
    await http()
      .patch(`/api/v1/seller/products/${sneaker.id}`)
      .set(bearer(owner))
      .send({ sizeChartId: theirs.id })
      .expect(400);
    await http()
      .patch(`/api/v1/seller/products/${sneaker.id}`)
      .set(bearer(owner))
      .send({ sizeChartId: mine.id })
      .expect(200);
    const guide = (await detail(sneaker.slug)).sizeGuide!;
    expect(guide.chart).toEqual({
      name: `Runner fit ${run}`,
      note: null,
      columns: ['Foot (cm)'],
      rows: [
        { size: '9', values: ['27.2'] },
        { size: '10', values: ['28.1'] },
      ],
    });
    // A bad chart is refused with where the problem is.
    const bad = await http()
      .post('/api/v1/seller/size-charts')
      .set(bearer(owner))
      .send({ name: `Bad ${run}`, categoryId: shoesId, text: 'Size, Foot\n9' })
      .expect(400);
    expect(JSON.stringify(bad.body)).toContain('Line 2');
    // Another store can't change it; the list shows the store's charts and NIXZORA's.
    await http()
      .put(`/api/v1/seller/size-charts/${mine.id}`)
      .set(bearer(other))
      .send({ name: 'Nope', categoryId: shoesId, text: 'Size, A\n1, 2' })
      .expect(404);
    const list = (await http().get('/api/v1/seller/size-charts').set(bearer(owner)).expect(200))
      .body as SizeChartView[];
    expect(list.map((c) => c.name)).toEqual(
      expect.arrayContaining([`Runner fit ${run}`, `Default shoes ${run}`]),
    );
    expect(list.some((c) => c.name === `Other ${run}`)).toBe(false);
  });

  it('says how it fits once enough reviewers agree', async () => {
    const reviewers = await prisma.user.findMany({
      where: { email: { contains: `-${run}@` } },
      select: { id: true },
    });
    const extra = await Promise.all(
      [1, 2].map((n) =>
        prisma.user.create({ data: { email: `size-extra${n}-${run}@example.com` } }),
      ),
    );
    const fits = ['SMALL', 'SMALL', 'SMALL', 'TRUE', 'LARGE'] as const;
    await Promise.all(
      [...reviewers, ...extra].slice(0, 5).map((user, i) =>
        prisma.review.create({
          data: {
            productId: sneaker.id,
            userId: user.id,
            rating: 4,
            title: 'Comfy',
            body: 'Comfortable for long walks, good grip.',
            status: 'APPROVED',
            fit: fits[i],
          },
        }),
      ),
    );
    expect((await detail(sneaker.slug)).sizeGuide!.fit).toEqual({
      answers: 5,
      small: 3,
      trueToSize: 1,
      large: 1,
      verdict: 'SMALL',
    });
  });
});
