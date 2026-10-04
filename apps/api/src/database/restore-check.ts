import { type PrismaClient } from '../generated/prisma/client';

/**
 * Is a restored database usable? Run against the copy during a disaster-recovery drill
 * (docs/runbooks/disaster-recovery.md) or after a real restore, before any traffic goes to it.
 * Read-only: it never writes to the database it checks.
 */
export type RestoreCheck = { name: string; ok: boolean; detail: string };

export type RestoreReport = {
  ok: boolean;
  checks: RestoreCheck[];
  counts: Record<string, number>;
  /** Newest write found in the copy (orders, audit log, product events). */
  newestWriteAt: string | null;
  /** How much was lost: restore point minus newest write, in seconds (null without a restore time). */
  dataGapSeconds: number | null;
};

/** Tables that must exist (their row counts go in the report, to compare with the source). */
const TABLES = [
  'users',
  'roles',
  'permissions',
  'products',
  'product_variants',
  'inventory_items',
  'orders',
  'payments',
  'sellers',
  'audit_logs',
  'outbox_events',
  'product_events',
  'risk_assessments',
] as const;
/** Seeded by migrations, so present in every environment, even an empty one. */
const MUST_HAVE_ROWS = ['roles', 'permissions'] as const;

/** Partitioned parents (ADR-0022) and the append-only guard on the audit log (ADR-0004). */
const PARTITIONED = ['audit_logs', 'product_events', 'outbox_events'] as const;

export async function checkRestore(
  prisma: PrismaClient,
  options: { restoreTime?: Date; expectMigration?: string } = {},
): Promise<RestoreReport> {
  const checks: RestoreCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  // 1. Migrations: all applied, none half-applied, and the newest one is what the release expects.
  const migrations = await prisma.$queryRaw<
    { name: string; finished: boolean; rolled_back: boolean }[]
  >`SELECT migration_name AS name, finished_at IS NOT NULL AS finished,
           rolled_back_at IS NOT NULL AS rolled_back
    FROM _prisma_migrations ORDER BY migration_name`;
  const unfinished = migrations.filter((m) => !m.finished && !m.rolled_back);
  const latest = migrations.filter((m) => m.finished).at(-1)?.name ?? null;
  add(
    'migrations',
    migrations.length > 0 && unfinished.length === 0,
    unfinished.length
      ? `unfinished: ${unfinished.map((m) => m.name).join(', ')}`
      : `${migrations.length} applied, newest ${latest}`,
  );
  if (options.expectMigration) {
    add(
      'migration matches release',
      latest === options.expectMigration,
      `expected ${options.expectMigration}, found ${latest}`,
    );
  }

  // 2. Tables exist, with row counts (estimates are not enough: a drill compares exact numbers).
  const counts: Record<string, number> = {};
  for (const table of TABLES) {
    const exists = await prisma.$queryRaw<{ found: boolean }[]>`
      SELECT to_regclass(${`public.${table}`}) IS NOT NULL AS found`;
    if (!exists[0]?.found) {
      add(`table ${table}`, false, 'missing');
      continue;
    }
    const rows = await prisma.$queryRawUnsafe<{ n: bigint }[]>(
      `SELECT count(*)::bigint AS n FROM "${table}"`,
    );
    counts[table] = Number(rows[0]?.n ?? 0);
  }
  const empty = MUST_HAVE_ROWS.filter((table) => !counts[table]);
  add(
    'reference data',
    empty.length === 0,
    empty.length ? `empty: ${empty.join(', ')}` : 'roles and permissions present',
  );

  // 3. Structure that Prisma does not describe: partitions and the audit log guard.
  const partitioned = await prisma.$queryRaw<{ name: string }[]>`
    SELECT c.relname AS name FROM pg_partitioned_table p
    JOIN pg_class c ON c.oid = p.partrelid`;
  const parents = new Set(partitioned.map((row) => row.name));
  const notPartitioned = PARTITIONED.filter((table) => !parents.has(table));
  add(
    'partitions',
    notPartitioned.length === 0,
    notPartitioned.length
      ? `not partitioned: ${notPartitioned.join(', ')}`
      : 'event tables partitioned',
  );
  const guards = await prisma.$queryRaw<{ n: bigint }[]>`
    SELECT count(*)::bigint AS n FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'audit_logs' AND NOT t.tgisinternal`;
  add(
    'audit log is append-only',
    Number(guards[0]?.n ?? 0) > 0,
    `${guards[0]?.n ?? 0} guard trigger(s)`,
  );

  // 4. How recent is the data? Against the restore point, that is the data actually lost.
  const newest = await prisma.$queryRaw<{ at: Date | null }[]>`
    SELECT greatest(
      (SELECT max(created_at) FROM orders),
      (SELECT max(created_at) FROM audit_logs),
      (SELECT max(created_at) FROM product_events)
    ) AS at`;
  const newestWriteAt = newest[0]?.at ?? null;
  const dataGapSeconds =
    options.restoreTime && newestWriteAt
      ? Math.max(0, Math.round((options.restoreTime.getTime() - newestWriteAt.getTime()) / 1000))
      : null;
  if (options.restoreTime && newestWriteAt && newestWriteAt > options.restoreTime) {
    add(
      'restore point',
      false,
      `data newer than the restore point (${newestWriteAt.toISOString()})`,
    );
  }

  return {
    ok: checks.every((check) => check.ok),
    checks,
    counts,
    newestWriteAt: newestWriteAt?.toISOString() ?? null,
    dataGapSeconds,
  };
}
