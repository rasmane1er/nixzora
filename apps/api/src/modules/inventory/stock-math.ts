/** Pure stock arithmetic used by InventoryService (unit-tested in stock-math.spec.ts). */

export type ReservationRequest = { variantId: string; quantity: number };

/** How long a checkout hold lasts unless the caller says otherwise. */
export const DEFAULT_HOLD_MINUTES = 15;

/** Adds up the quantity per variant (a cart may list one variant on several lines). */
export function sumByVariant(items: readonly ReservationRequest[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const item of items) {
    totals.set(item.variantId, (totals.get(item.variantId) ?? 0) + item.quantity);
  }
  return totals;
}

/** When a hold made now for `minutes` runs out. */
export function holdExpiry(minutes: number, now = Date.now()): Date {
  return new Date(now + minutes * 60_000);
}

/** Units free to sell: never negative. */
export function availableOf(onHand: number, reserved: number): number {
  return Math.max(0, onHand - reserved);
}

export type CommitLine = {
  variantId: string;
  /** Taken from this order's own holds. */
  fromHold: number;
  /** Taken from free stock because the hold had expired (or was smaller). */
  fromFree: number;
  /** Could not be covered at all: oversold. */
  missing: number;
};

/**
 * Splits each ordered quantity between the order's holds, free stock and a shortfall.
 * `stock` has the locked rows; a variant without a row has no stock at all.
 */
export function planCommit(
  wanted: ReadonlyMap<string, number>,
  stock: ReadonlyMap<string, { onHand: number; reserved: number }>,
  held: ReadonlyMap<string, number>,
): CommitLine[] {
  return [...wanted].map(([variantId, quantity]) => {
    const row = stock.get(variantId);
    if (!row) return { variantId, fromHold: 0, fromFree: 0, missing: quantity };
    const fromHold = Math.min(held.get(variantId) ?? 0, quantity);
    const fromFree = Math.min(availableOf(row.onHand, row.reserved), quantity - fromHold);
    return { variantId, fromHold, fromFree, missing: quantity - fromHold - fromFree };
  });
}
