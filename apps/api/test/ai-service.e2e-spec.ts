import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.AI_DRIVER = 'local';
process.env.EMBEDDINGS_DRIVER = 'local';
process.env.INTERNAL_API_KEY = 'a'.repeat(48);
delete process.env.AI_SERVICE_URL;

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { type AddressInfo } from 'node:net';
import request from 'supertest';
import { AiServiceModule } from '../src/ai-service/ai-service.module';
import { LocalLanguageModel } from '../src/modules/assistant/language-model';
import {
  AiGatewayClient,
  RemoteEmbeddings,
  RemoteLanguageModel,
} from '../src/modules/ai/ai-gateway';
import { LocalEmbeddings } from '../src/modules/ai/embeddings';

/**
 * The AI service (ADR-0016) with the offline drivers: what goes through it must come back exactly
 * as the provider answers in-process, and only internal callers with the key get in.
 */
describe('AI service (e2e)', () => {
  let app: INestApplication;
  let client: AiGatewayClient;
  const KEY = process.env.INTERNAL_API_KEY!;
  const local = new LocalEmbeddings();

  beforeAll(async () => {
    app = (
      await Test.createTestingModule({ imports: [AiServiceModule] }).compile()
    ).createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    const { port } = app.getHttpServer().address() as AddressInfo;
    client = new AiGatewayClient(`http://127.0.0.1:${port}`, KEY, 5000);
  });

  afterAll(async () => {
    app.getHttpServer().closeAllConnections();
    await app.close();
  });

  it('answers only callers with the internal key, and reports its models', async () => {
    // The health check is open (ECS calls it); it shows model names only, no keys.
    const ok = await request(app.getHttpServer()).get('/health').expect(200);
    expect(ok.body).toMatchObject({ service: 'ai', embeddings: `local:${local.model}` });
    await request(app.getHttpServer())
      .post('/internal/ai/embed')
      .set('x-internal-key', 'b'.repeat(48))
      .send({ model: local.model, texts: ['x'], purpose: 'query' })
      .expect(401);
    await request(app.getHttpServer())
      .post('/internal/ai/embed')
      .send({ model: local.model, texts: ['x'], purpose: 'query' })
      .expect(401);
  });

  it('embeds exactly like the provider in-process', async () => {
    const remote = new RemoteEmbeddings(client, 'local', local.model);
    const texts = ['quiet laptop for flights', 'noise cancelling headphones'];
    expect(await remote.embed(texts, 'document')).toEqual(await local.embed(texts));
  });

  it('refuses a caller that expects another model', async () => {
    const remote = new RemoteEmbeddings(client, 'voyage', 'voyage-4-lite');
    await expect(remote.embed(['laptop'], 'query')).rejects.toThrow('409');
  });

  it('understands requests and writes answers like the provider in-process', async () => {
    const remote = new RemoteLanguageModel(client, 'local', 'local');
    const categories = [{ slug: 'laptops', name: 'Laptops' }];
    const turns = ['a quiet laptop for coding under $1,500'];
    const expected = await new LocalLanguageModel().understand(turns, categories);
    expect(await remote.understand(turns, categories)).toEqual(expected);

    const input = {
      request: turns[0]!,
      needSummary: 'a quiet laptop under $1,500',
      picks: [],
      relaxed: [],
    };
    expect(await remote.explain(input)).toEqual(await new LocalLanguageModel().explain(input));
  });

  it('checks request bodies', async () => {
    await request(app.getHttpServer())
      .post('/internal/ai/embed')
      .set('x-internal-key', KEY)
      .send({ model: local.model, texts: [], purpose: 'query' })
      .expect(400);
  });
});
