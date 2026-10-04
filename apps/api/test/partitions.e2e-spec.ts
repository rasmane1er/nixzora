import 'dotenv/config';

process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_ENABLED = 'false';

import { type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PartitionMaintenance } from '../src/database/partition-maintenance';
import { OutboxService } from '../src/modules/outbox/outbox.service';
import { PrismaService } from '../src/prisma/prisma.service';

/** Monthly partitions of the event tables (ADR-0022). */
describe('Event table partitions (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let maintenance: PartitionMaintenance;
  const run = Date.now().toString(36);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    maintenance = app.get(PartitionMaintenance);
  }, 30_000);

  afterAll(async () => {
    await prisma.outboxEvent.deleteMany({ where: { aggregateId: { startsWith: `part-${run}` } } });
    await app.close();
  });

  const partitions = async (table: string) =>
    (
      await prisma.$queryRaw<{ name: string }[]>`
        SELECT c.relname AS name FROM pg_inherits i JOIN pg_class c ON c.oid = i.inhrelid
        WHERE i.inhparent = ${table}::regclass ORDER BY 1`
    ).map((row) => row.name);
  const monthsAgo = (n: number) => {
    const date = new Date();
    date.setUTCDate(15);
    date.setUTCMonth(date.getUTCMonth() - n);
    return date;
  };
  const label = (date: Date) =>
    `${date.getUTCFullYear()}_${String(date.getUTCMonth() + 1).padStart(2, '0')}`;

  it('keeps the next months ready, so rows never land in the default partition', async () => {
    await maintenance.run();
    const ahead = new Date();
    ahead.setUTCDate(1);
    ahead.setUTCMonth(ahead.getUTCMonth() + 3);
    for (const table of ['audit_logs', 'product_events', 'outbox_events']) {
      const names = await partitions(table);
      expect(names).toContain(`${table}_${label(new Date())}`);
      expect(names).toContain(`${table}_${label(ahead)}`);
      expect(names).toContain(`${table}_default`);
    }
    const [row] = await prisma.$queryRaw<{ n: bigint }[]>`
      SELECT count(*) AS n FROM partitions.outbox_events_default`;
    expect(Number(row?.n)).toBe(0);
  });

  it('drops outbox months past retention, but not while an event still waits for delivery', async () => {
    const old = monthsAgo(5);
    await prisma.$queryRaw`SELECT partitions.ensure_monthly('outbox_events'::regclass, ${old}::date, 3)`;
    const handled = app.get(OutboxService).handledTypes()[0]!;
    const waiting = await prisma.outboxEvent.create({
      data: {
        id: randomUUID(),
        aggregateType: 'order',
        aggregateId: `part-${run}`,
        type: handled,
        payload: {},
        createdAt: old,
        streamedAt: old,
      },
    });
    const name = `outbox_events_${label(old)}`;

    await maintenance.run();
    expect(await partitions('outbox_events')).toContain(name);

    await prisma.outboxEvent.update({
      where: { id: waiting.id },
      data: { publishedAt: new Date() },
    });
    const result = await maintenance.run();
    expect(result.dropped.outbox_events).toBeGreaterThanOrEqual(1);
    expect(await partitions('outbox_events')).not.toContain(name);
  });

  it('keeps the audit log append-only, partitions or not', async () => {
    await expect(
      prisma.$executeRaw`UPDATE audit_logs SET action = 'changed' WHERE id = (SELECT min(id) FROM audit_logs)`,
    ).rejects.toThrow(/append-only|not allowed|cannot/i);
  });
});
