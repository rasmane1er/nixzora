import 'dotenv/config';

import { type ConfigService } from '@nestjs/config';
import { type Env } from '../src/config/env';
import { withConnectionUrls } from '../src/config/connection-urls';
import { PrismaService } from '../src/prisma/prisma.service';
import { isConnectionError, ReadDatabase } from '../src/prisma/read-database';

/** Read routing (ADR-0022) against the development database playing the replica. */
describe('Read replica routing (e2e)', () => {
  const url = withConnectionUrls(process.env).DATABASE_URL!;
  const config = (replica?: string) =>
    ({
      get: (key: keyof Env) =>
        key === 'DATABASE_URL' ? url : key === 'DATABASE_REPLICA_URL' ? replica : undefined,
    }) as unknown as ConfigService<Env, true>;
  const primary = new PrismaService(config());
  const opened: ReadDatabase[] = [];
  const open = async (replica?: string) => {
    const db = new ReadDatabase(primary, config(replica));
    opened.push(db);
    await db.onModuleInit();
    return db;
  };

  afterAll(async () => {
    for (const db of opened) await db.onModuleDestroy();
    await primary.$disconnect();
  });

  it('reads the primary when no replica is configured', async () => {
    const db = await open();
    expect(db.client).toBe(primary);
    expect(db.status()).toEqual({ configured: false, usable: false });
  });

  it('reads a healthy replica, models and raw SQL alike', async () => {
    const db = await open(url);
    expect(db.status()).toMatchObject({ configured: true, usable: true, lagSeconds: 0 });
    expect(await db.client.user.count()).toBe(await primary.user.count());
    const n = 41;
    const [row] = await db.client.$queryRaw<{ x: number }[]>`SELECT ${n}::int + 1 AS x`;
    expect(row?.x).toBe(42);
  });

  it('falls back to the primary when the replica cannot be reached', async () => {
    const down = url.replace(/@([^:/]+)(:\d+)?\//, '@127.0.0.1:1/');
    const db = await open(down);
    expect(db.status()).toMatchObject({ configured: true, usable: false });
    // Still answers: from the primary.
    expect(await db.client.user.count()).toBe(await primary.user.count());
    const [row] = await db.client.$queryRaw<{ ok: number }[]>`SELECT 1::int AS ok`;
    expect(row?.ok).toBe(1);
  });

  it('tells connection failures from query errors', () => {
    expect(isConnectionError({ code: 'P1001' })).toBe(true);
    expect(isConnectionError(new Error('connect ECONNREFUSED 127.0.0.1:1'))).toBe(true);
    expect(isConnectionError({ code: 'P2002', message: 'Unique constraint failed' })).toBe(false);
  });
});
