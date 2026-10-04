import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { type Env } from '../config/env';
import { PrismaService } from './prisma.service';

/** A replica this far behind the primary is skipped until it catches up. */
const MAX_LAG_SECONDS = 30;
/** How often the replica's lag is measured. */
const CHECK_MS = 15_000;
/** After a connection failure, reads go to the primary for this long. */
const COOLDOWN_MS = 30_000;

export type ReplicaStatus = { configured: boolean; usable: boolean; lagSeconds?: number };

/**
 * Where read-only queries go (ADR-0022): the PostgreSQL read replica when DATABASE_REPLICA_URL is
 * set, otherwise the primary. Only reads that tolerate a few seconds of staleness use it (the
 * public catalog, recommendations); anything a customer just wrote (cart, orders, account) reads
 * the primary. If the replica is unreachable or more than 30 s behind, reads fall back to the
 * primary on their own, so a replica problem never takes the storefront down.
 */
@Injectable()
export class ReadDatabase implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReadDatabase.name);
  private readonly replica?: PrismaClient;
  private readonly routed: PrismaClient;
  private usableUntil = 0;
  private lagSeconds?: number;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly primary: PrismaService,
    config: ConfigService<Env, true>,
  ) {
    const url = config.get('DATABASE_REPLICA_URL', { infer: true });
    if (!url) {
      this.routed = primary;
      return;
    }
    this.replica = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
    // Every query on the read client: replica when healthy, primary otherwise (or on failure).
    const route = async (
      model: string | undefined,
      operation: string,
      args: unknown,
      query: (args: unknown) => Promise<unknown>,
    ): Promise<unknown> => {
      if (!this.usable) return this.onPrimary(model, operation, args);
      try {
        return await query(args);
      } catch (error) {
        if (!isConnectionError(error)) throw error;
        this.markDown((error as Error).message);
        return this.onPrimary(model, operation, args);
      }
    };
    this.routed = this.replica.$extends({
      query: {
        $allOperations: ({ model, operation, args, query }) =>
          route(model, operation, args, query as (args: unknown) => Promise<unknown>),
      },
    }) as unknown as PrismaClient;
  }

  /** The client for stale-tolerant reads. */
  get client(): PrismaClient {
    return this.routed;
  }

  get usable(): boolean {
    return Boolean(this.replica) && Date.now() < this.usableUntil;
  }

  status(): ReplicaStatus {
    return {
      configured: Boolean(this.replica),
      usable: this.usable,
      ...(this.lagSeconds !== undefined ? { lagSeconds: this.lagSeconds } : {}),
    };
  }

  async onModuleInit(): Promise<void> {
    if (!this.replica) return;
    await this.checkLag();
    this.timer = setInterval(() => void this.checkLag(), CHECK_MS);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.replica?.$disconnect();
  }

  /** Seconds since the replica last replayed a transaction (0 when there was nothing to replay). */
  async checkLag(): Promise<void> {
    if (!this.replica) return;
    try {
      const [row] = await this.replica.$queryRaw<{ lag: number | null; replica: boolean }[]>`
        SELECT pg_is_in_recovery() AS replica,
               CASE WHEN pg_last_wal_receive_lsn() = pg_last_wal_replay_lsn() THEN 0
                    ELSE EXTRACT(EPOCH FROM now() - pg_last_xact_replay_timestamp())::float8
               END AS lag`;
      this.lagSeconds = row?.replica ? Math.max(0, Number(row.lag ?? 0)) : 0;
      if (this.lagSeconds > MAX_LAG_SECONDS) {
        if (this.usable)
          this.logger.warn(
            `Read replica ${this.lagSeconds.toFixed(0)} s behind: using the primary`,
          );
        this.usableUntil = 0;
      } else {
        this.usableUntil = Date.now() + CHECK_MS * 2;
      }
    } catch (error) {
      this.markDown((error as Error).message);
    }
  }

  private markDown(reason: string): void {
    if (this.usable || this.usableUntil === 0) {
      this.logger.warn(`Read replica unavailable, reading from the primary: ${reason}`);
    }
    this.usableUntil = 0;
    // Try again after the cooldown (the lag check re-enables it when healthy).
    setTimeout(() => void this.checkLag(), COOLDOWN_MS).unref();
  }

  /** The same call on the primary ($queryRaw receives the Sql object as its argument). */
  private onPrimary(model: string | undefined, operation: string, args: unknown): Promise<unknown> {
    type Call = (args: unknown) => Promise<unknown>;
    const primary = this.primary as unknown as Record<string, Record<string, Call> | Call>;
    if (!model) return (primary[operation] as Call).call(this.primary, args);
    const delegate = primary[model.charAt(0).toLowerCase() + model.slice(1)] as Record<
      string,
      Call
    >;
    return delegate[operation]!(args);
  }
}

/** Errors that mean "could not talk to the server", not "the query was wrong". */
export function isConnectionError(error: unknown): boolean {
  const e = error as { code?: string; name?: string; message?: string };
  if (e?.name === 'PrismaClientInitializationError') return true;
  if (
    e?.code &&
    ['P1001', 'P1002', 'P1008', 'P1017', 'ECONNREFUSED', 'ETIMEDOUT'].includes(e.code)
  ) {
    return true;
  }
  return /ECONNREFUSED|ETIMEDOUT|Connection terminated|server closed the connection|Can't reach database/i.test(
    e?.message ?? '',
  );
}
