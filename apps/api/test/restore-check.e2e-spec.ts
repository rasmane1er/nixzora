import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { withConnectionUrls } from '../src/config/connection-urls';
import { checkRestore } from '../src/database/restore-check';
import { PrismaClient } from '../src/generated/prisma/client';

/** The disaster-recovery check, run against the migrated test database (a "restore" of itself). */
describe('Restore check (e2e)', () => {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: withConnectionUrls(process.env).DATABASE_URL! }),
  });

  afterAll(() => prisma.$disconnect());

  it('passes on a fully migrated database and reports row counts', async () => {
    const report = await checkRestore(prisma, { restoreTime: new Date(Date.now() + 60_000) });
    expect(report.checks.filter((check) => !check.ok)).toEqual([]);
    expect(report.ok).toBe(true);
    expect(report.counts.roles).toBeGreaterThan(0);
    expect(Object.keys(report.counts)).toEqual(expect.arrayContaining(['orders', 'audit_logs']));
  });

  it('fails when the copy is behind the release', async () => {
    const report = await checkRestore(prisma, {
      expectMigration: '29990101000000_from_the_future',
    });
    expect(report.ok).toBe(false);
    expect(report.checks.find((check) => check.name === 'migration matches release')?.ok).toBe(
      false,
    );
  });

  it('flags data newer than the restore point (the wrong instance was checked)', async () => {
    const [newest] = await prisma.$queryRaw<{ at: Date | null }[]>`
      SELECT max(created_at) AS at FROM audit_logs`;
    if (!newest?.at) return; // an empty database has nothing to compare
    const report = await checkRestore(prisma, {
      restoreTime: new Date(newest.at.getTime() - 1000),
    });
    expect(report.checks.find((check) => check.name === 'restore point')?.ok).toBe(false);
  });
});
