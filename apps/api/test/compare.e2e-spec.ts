import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';
process.env.EMBEDDINGS_DRIVER = 'local';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type CompareView } from '@nixzora/validation';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { removeTestData } from './cleanup';

describe('Compare products (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const run = Date.now().toString(36);
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    const cat = await prisma.category.create({ data: { slug: `cmpcat-${run}`, name: 'Cmp' } });
    const make = (key: string, attributes: Record<string, unknown>) =>
      prisma.product.create({
        data: {
          slug: `${key}-${run}`,
          title: `${key} ${run}`,
          description: 'A test listing.',
          status: 'ACTIVE',
          categoryId: cat.id,
          attributes: attributes as object,
          variants: {
            create: [
              {
                sku: `${key}-${run}`.toUpperCase(),
                title: 'Standard',
                priceCents: 10_000,
                inventory: { create: { onHand: 3 } },
              },
            ],
          },
        },
      });
    await make('cmp-a', { ram_gb: 16, weight_kg: 1.2, color_family: 'silver' });
    await make('cmp-b', { ram_gb: 32, weight_kg: 1.2 });
  }, 60_000);

  afterAll(async () => {
    await removeTestData(prisma, run);
    await app.close();
  });

  it('puts products side by side, shared specs first, differences marked', async () => {
    const view = (
      await http()
        .get('/api/v1/catalog/compare')
        .query({ products: `cmp-a-${run},cmp-b-${run},gone-${run}` })
        .expect(200)
    ).body as CompareView;
    expect(view.products.map((p) => p.slug)).toEqual([`cmp-a-${run}`, `cmp-b-${run}`]);
    expect(view.specs.slice(0, 2).sort()).toEqual(['ram_gb', 'weight_kg']);
    expect(view.specs[2]).toBe('color_family');
    expect(view.differing.sort()).toEqual(['color_family', 'ram_gb']);
    expect(view.products[0]!.delivery).toBeTruthy();
  });

  it('takes at most four', async () => {
    await http().get('/api/v1/catalog/compare').query({ products: 'a,b,c,d,e' }).expect(400);
  });
});
