import { type CartBundle } from '@nixzora/validation';

export type BundleRule = {
  id: string;
  title: string;
  percentOff: number;
  /** Who funds it: the store, or null for NIXZORA. */
  sellerId: string | null;
  productIds: string[];
};

export type BundleSaving = CartBundle & { sellerId: string | null };

/** Every unit's price, by product, cheapest first. */
export function unitsOf(
  lines: { productId: string; unitPriceCents: number; quantity: number }[],
): Map<string, number[]> {
  const units = new Map<string, number[]>();
  for (const line of lines) {
    const list = units.get(line.productId) ?? [];
    for (let i = 0; i < line.quantity; i++) list.push(line.unitPriceCents);
    units.set(line.productId, list);
  }
  for (const list of units.values()) list.sort((a, b) => a - b);
  return units;
}

/**
 * What bundles save on a cart (p10-16). A set is one unit of every product in the bundle; each
 * set takes the bundle's percentage off those units. A unit counts towards one set only, so
 * bundles sharing a product never discount it twice: bundles with the bigger percentage (then
 * more products) are filled first, and each set uses the cheapest units left.
 */
export function bundleSavings(
  lines: { productId: string; unitPriceCents: number; quantity: number }[],
  bundles: BundleRule[],
  /** The cart's unit prices by product; the units bundles use are taken out of it. */
  units: Map<string, number[]> = unitsOf(lines),
): BundleSaving[] {
  const ordered = [...bundles].sort(
    (a, b) => b.percentOff - a.percentOff || b.productIds.length - a.productIds.length,
  );
  const savings: BundleSaving[] = [];
  for (const bundle of ordered) {
    let sets = 0;
    let discount = 0;
    while (bundle.productIds.every((id) => (units.get(id)?.length ?? 0) > 0)) {
      const prices = bundle.productIds.map((id) => units.get(id)!.shift()!);
      discount += Math.round((prices.reduce((sum, p) => sum + p, 0) * bundle.percentOff) / 100);
      sets++;
    }
    if (sets) {
      savings.push({
        id: bundle.id,
        title: bundle.title,
        percentOff: bundle.percentOff,
        sets,
        discountCents: discount,
        sellerId: bundle.sellerId,
      });
    }
  }
  return savings;
}
