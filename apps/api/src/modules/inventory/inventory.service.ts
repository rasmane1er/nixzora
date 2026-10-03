import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { type InventoryAdjust } from '@nixzora/validation';
import { type Prisma } from '../../generated/prisma/client';
import { type Env } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { AuditService } from '../audit/audit.service';
import { type ActorContext } from '../identity/guards/actor.decorator';
import { runsBackgroundJobs } from '../../common/background-jobs';

export type ReservationRequest = { variantId: string; quantity: number };

export type StockRow = {
  variantId: string;
  sku: string;
  variantTitle: string;
  productId: string;
  productTitle: string;
  onHand: number;
  reserved: number;
  available: number;
};

type LockedRow = { variant_id: string; on_hand: number; reserved: number };

const SWEEP_INTERVAL_MS = 60_000;
const SWEEP_LOCK = 'inventory:sweep-lock';

/**
 * Stock levels and checkout holds.
 * Every change locks the affected inventory rows (SELECT … FOR UPDATE) inside one
 * transaction, always in the same order, so concurrent checkouts can never oversell
 * and never deadlock each other.
 */
@Injectable()
export class InventoryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InventoryService.name);
  private sweeper?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly audit: AuditService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (!runsBackgroundJobs(this.config)) return;
    this.sweeper = setInterval(() => void this.sweepExpired(), SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  onModuleDestroy(): void {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  async adjust(variantId: string, input: InventoryAdjust, actor: ActorContext): Promise<StockRow> {
    const variant = await this.prisma.productVariant.findUnique({ where: { id: variantId } });
    if (!variant) throw new NotFoundException('Variant not found.');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.inventoryItem.upsert({
        where: { variantId },
        create: { variantId, onHand: 0 },
        update: {},
      });
      const [row] = await this.lock(tx, [variantId]);
      const before = row!.on_hand;
      const after = before + input.delta;
      if (after < 0)
        throw new ConflictException(`Only ${before} on hand; cannot remove ${-input.delta}.`);
      if (after < row!.reserved) {
        throw new ConflictException(
          `${row!.reserved} units are held by open checkouts; on-hand cannot go below that.`,
        );
      }
      await tx.inventoryItem.update({ where: { variantId }, data: { onHand: after } });
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'inventory',
          aggregateId: variantId,
          type: 'inventory.changed',
          payload: { variantId, sku: variant.sku, onHand: after, reserved: row!.reserved },
        },
      });
      return { before, after };
    });

    await this.audit.record({
      action: 'inventory.adjusted',
      actorType: actor.actorType ?? 'ADMIN',
      actorId: actor.user.id,
      entityType: 'variant',
      entityId: variantId,
      meta: actor.meta,
      metadata: {
        sku: variant.sku,
        delta: input.delta,
        reason: input.reason,
        note: input.note,
        ...result,
      },
    });
    return this.stockFor(variantId);
  }

  /**
   * Holds stock for a checkout. All-or-nothing: if any line is short, nothing is held.
   * Returns reservation ids to commit after payment or release on cancel.
   */
  async reserve(
    items: ReservationRequest[],
    orderId: string | null,
    ttlMinutes = 15,
  ): Promise<string[]> {
    const wanted = new Map<string, number>();
    for (const item of items)
      wanted.set(item.variantId, (wanted.get(item.variantId) ?? 0) + item.quantity);
    const variantIds = [...wanted.keys()];

    return this.prisma.$transaction(async (tx) => {
      const rows = await this.lock(tx, variantIds);
      const byId = new Map(rows.map((row) => [row.variant_id, row]));

      const short = variantIds.filter((id) => {
        const row = byId.get(id);
        return !row || row.on_hand - row.reserved < wanted.get(id)!;
      });
      if (short.length) {
        const skus = await tx.productVariant.findMany({
          where: { id: { in: short } },
          select: { sku: true },
        });
        throw new ConflictException({
          statusCode: 409,
          error: 'Conflict',
          code: 'INSUFFICIENT_STOCK',
          message: `Not enough stock for ${skus.map((s) => s.sku).join(', ')}.`,
          variantIds: short,
        });
      }

      const expiresAt = new Date(Date.now() + ttlMinutes * 60_000);
      const ids: string[] = [];
      for (const variantId of variantIds) {
        const quantity = wanted.get(variantId)!;
        await tx.inventoryItem.update({
          where: { variantId },
          data: { reserved: { increment: quantity } },
        });
        const reservation = await tx.inventoryReservation.create({
          data: { variantId, orderId, quantity, expiresAt },
        });
        ids.push(reservation.id);
      }
      return ids;
    });
  }

  /** Gives held stock back (checkout abandoned or cancelled). Safe to call twice. */
  async release(reservationIds: string[]): Promise<number> {
    return this.settle(reservationIds, 'release');
  }

  /** Payment succeeded: held units leave the warehouse count. */
  async commit(reservationIds: string[]): Promise<number> {
    return this.settle(reservationIds, 'commit');
  }

  /**
   * Releases holds whose checkout never finished. A Redis lock keeps instances from sweeping at
   * the same time; it is held only while sweeping (and expires on its own if an instance dies).
   */
  async sweepExpired(): Promise<number> {
    const token = randomUUID();
    let locked = false;
    try {
      locked = (await this.redis.client.set(SWEEP_LOCK, token, 'EX', 50, 'NX')) === 'OK';
      if (!locked) return 0;
    } catch {
      // Without Redis, run anyway: settle() is idempotent.
    }
    try {
      const expired = await this.prisma.inventoryReservation.findMany({
        where: { expiresAt: { lt: new Date() } },
        select: { id: true },
        take: 500,
      });
      const released = expired.length ? await this.release(expired.map((row) => row.id)) : 0;
      if (released) this.logger.log(`Released ${released} expired stock hold(s).`);
      return released;
    } finally {
      if (locked) {
        // Delete the lock only if it is still ours.
        await this.redis.client
          .eval(
            "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) end return 0",
            1,
            SWEEP_LOCK,
            token,
          )
          .catch(() => undefined);
      }
    }
  }

  /**
   * Payment captured: inside the caller's transaction, take the order's units out of stock.
   * Uses the checkout holds when they still exist; if a hold already expired, takes the units
   * from free stock instead. Returns the variants that could not be covered (oversold).
   */
  async commitOrder(
    tx: Prisma.TransactionClient,
    orderId: string,
    items: ReservationRequest[],
  ): Promise<{ variantId: string; missing: number }[]> {
    const wanted = new Map<string, number>();
    for (const item of items)
      wanted.set(item.variantId, (wanted.get(item.variantId) ?? 0) + item.quantity);
    const rows = await this.lock(tx, [...wanted.keys()]);
    const byId = new Map(rows.map((row) => [row.variant_id, row]));
    const holds = await tx.inventoryReservation.findMany({ where: { orderId } });
    const held = new Map<string, number>();
    for (const hold of holds)
      held.set(hold.variantId, (held.get(hold.variantId) ?? 0) + hold.quantity);

    const shortfall: { variantId: string; missing: number }[] = [];
    for (const [variantId, quantity] of wanted) {
      const row = byId.get(variantId);
      if (!row) {
        shortfall.push({ variantId, missing: quantity });
        continue;
      }
      const fromHold = Math.min(held.get(variantId) ?? 0, quantity);
      const free = row.on_hand - row.reserved;
      const fromFree = Math.min(Math.max(0, free), quantity - fromHold);
      const missing = quantity - fromHold - fromFree;
      if (missing > 0) shortfall.push({ variantId, missing });
      await tx.inventoryItem.update({
        where: { variantId },
        data: {
          reserved: { decrement: held.get(variantId) ?? 0 },
          onHand: { decrement: fromHold + fromFree },
        },
      });
    }
    // Holds on variants no longer in the order (should not happen) are released too.
    for (const [variantId, quantity] of held) {
      if (!wanted.has(variantId)) {
        await tx.inventoryItem.update({
          where: { variantId },
          data: { reserved: { decrement: quantity } },
        });
      }
    }
    await tx.inventoryReservation.deleteMany({ where: { orderId } });
    return shortfall;
  }

  /** Checkout abandoned or cancelled before payment: give the order's holds back. */
  async releaseOrder(orderId: string): Promise<number> {
    const holds = await this.prisma.inventoryReservation.findMany({
      where: { orderId },
      select: { id: true },
    });
    return this.release(holds.map((hold) => hold.id));
  }

  /** Paid order cancelled before shipping: its units go back on the shelf. */
  async restock(tx: Prisma.TransactionClient, items: ReservationRequest[]): Promise<void> {
    const existing = await this.lock(
      tx,
      items.map((item) => item.variantId),
    );
    const known = new Set(existing.map((row) => row.variant_id));
    for (const item of items) {
      if (!known.has(item.variantId)) continue;
      await tx.inventoryItem.update({
        where: { variantId: item.variantId },
        data: { onHand: { increment: item.quantity } },
      });
    }
  }

  /** Re-holds stock for an order whose holds expired while the customer was paying. */
  async holdForOrder(
    orderId: string,
    items: ReservationRequest[],
    ttlMinutes: number,
  ): Promise<void> {
    const existing = await this.prisma.inventoryReservation.count({ where: { orderId } });
    if (existing > 0) {
      await this.prisma.inventoryReservation.updateMany({
        where: { orderId },
        data: { expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
      });
      return;
    }
    await this.reserve(items, orderId, ttlMinutes);
  }

  async stockFor(variantId: string): Promise<StockRow> {
    const rows = await this.list({ variantIds: [variantId] });
    if (!rows[0]) throw new NotFoundException('Variant not found.');
    return rows[0];
  }

  async list(
    filter: { q?: string; lowStockThreshold?: number; variantIds?: string[] } = {},
  ): Promise<StockRow[]> {
    const variants = await this.prisma.productVariant.findMany({
      where: {
        ...(filter.variantIds ? { id: { in: filter.variantIds } } : {}),
        ...(filter.q
          ? {
              OR: [
                { sku: { contains: filter.q, mode: 'insensitive' } },
                { product: { title: { contains: filter.q, mode: 'insensitive' } } },
              ],
            }
          : {}),
      },
      include: { inventory: true, product: { select: { id: true, title: true } } },
      orderBy: [{ product: { title: 'asc' } }, { sku: 'asc' }],
      take: 500,
    });

    const rows = variants.map((variant) => {
      const onHand = variant.inventory?.onHand ?? 0;
      const reserved = variant.inventory?.reserved ?? 0;
      return {
        variantId: variant.id,
        sku: variant.sku,
        variantTitle: variant.title,
        productId: variant.product.id,
        productTitle: variant.product.title,
        onHand,
        reserved,
        available: Math.max(0, onHand - reserved),
      };
    });

    return filter.lowStockThreshold === undefined
      ? rows
      : rows
          .filter((row) => row.available <= filter.lowStockThreshold!)
          .sort((a, b) => a.available - b.available);
  }

  // ───────────── Internals ─────────────

  /** Locks inventory rows in a fixed order (by id) to rule out deadlocks between checkouts. */
  private lock(tx: Prisma.TransactionClient, variantIds: string[]): Promise<LockedRow[]> {
    const sorted = [...variantIds].sort();
    return tx.$queryRaw<LockedRow[]>`
      SELECT variant_id::text AS variant_id, on_hand, reserved
      FROM inventory_items
      WHERE variant_id = ANY(${sorted}::uuid[])
      ORDER BY variant_id
      FOR UPDATE`;
  }

  private async settle(reservationIds: string[], mode: 'release' | 'commit'): Promise<number> {
    if (!reservationIds.length) return 0;
    return this.prisma.$transaction(async (tx) => {
      const reservations = await tx.inventoryReservation.findMany({
        where: { id: { in: reservationIds } },
      });
      if (!reservations.length) return 0;
      await this.lock(
        tx,
        reservations.map((r) => r.variantId),
      );
      for (const reservation of reservations) {
        await tx.inventoryItem.update({
          where: { variantId: reservation.variantId },
          data: {
            reserved: { decrement: reservation.quantity },
            ...(mode === 'commit' ? { onHand: { decrement: reservation.quantity } } : {}),
          },
        });
      }
      await tx.inventoryReservation.deleteMany({
        where: { id: { in: reservations.map((r) => r.id) } },
      });
      return reservations.length;
    });
  }
}
