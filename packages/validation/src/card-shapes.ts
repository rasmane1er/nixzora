import type { CategoryNode, ProductCard } from './catalog';
import type { SmartRow } from './recommendations';

/**
 * Card shapes (ADR-0061): the home, deals and product pages mix several card shapes so each
 * section reads differently, like a store aisle. These helpers decide which products go in which
 * shape, so the web and the app always lay out the same data the same way.
 */

/** A quad card holds up to four products under one title. */
export const QUAD_SIZE = 4;

/** Which shape shows a smart row (p10-02) on the home page. */
export type RowShape = 'quad' | 'priceDrop' | 'buyAgain' | 'ask' | 'rail';

const ROW_SHAPES: Record<SmartRow['kind'], RowShape> = {
  still_thinking: 'quad',
  saved_deals: 'priceDrop',
  restock: 'buyAgain',
  interest: 'ask',
  cart_addons: 'rail',
  accessories: 'rail',
};

/**
 * The shape for each row. Only the first interest becomes an Ask card; later ones stay rails,
 * so the page never shows two Ask cards.
 */
export function rowShapes(rows: SmartRow[]): { row: SmartRow; shape: RowShape }[] {
  let asked = false;
  return rows.map((row) => {
    let shape = ROW_SHAPES[row.kind];
    if (shape === 'ask') {
      if (asked || row.products.length < 1) shape = 'rail';
      asked = true;
    }
    return { row, shape };
  });
}

function live(product: ProductCard, now: number): boolean {
  return !!product.deal && Date.parse(product.deal.endsAt) > now && product.inStock;
}

/**
 * The deal for the spotlight card: the live one ending soonest, open to everyone (a Plus-only
 * deal would show a price most shoppers can't get). Null when nothing is live.
 */
export function spotlightDeal(deals: ProductCard[], now: number): ProductCard | null {
  let best: ProductCard | null = null;
  for (const product of deals) {
    if (!live(product, now) || product.deal!.plusOnly) continue;
    if (!best || Date.parse(product.deal!.endsAt) < Date.parse(best.deal!.endsAt)) best = product;
  }
  return best;
}

type Group = { slug: string; name: string };

/**
 * The top-level department of every category in the tree, so "kitchen" and "home-living" both
 * fill a "Home" quad.
 */
export function departmentLookup(tree: CategoryNode[]): (slug: string) => Group | undefined {
  const map = new Map<string, Group>();
  const walk = (node: CategoryNode, top: Group) => {
    map.set(node.slug, top);
    for (const child of node.children ?? []) walk(child, top);
  };
  for (const node of tree) walk(node, { slug: node.slug, name: node.name });
  return (slug) => map.get(slug);
}

/**
 * Products grouped for quad cards ("Deals in Kitchen"): by `groupOf` (their department) when
 * given, else by their own category. Only full groups of four, in the order their first product
 * appears, at most `max` groups. A product is used once.
 */
export function quadsByCategory(
  products: ProductCard[],
  max: number,
  groupOf?: (slug: string) => Group | undefined,
): { category: Group; products: ProductCard[] }[] {
  const groups = new Map<string, { category: Group; products: ProductCard[] }>();
  for (const product of products) {
    const category = groupOf?.(product.category.slug) ?? product.category;
    const group = groups.get(category.slug) ?? { category, products: [] };
    if (group.products.length < QUAD_SIZE) group.products.push(product);
    groups.set(category.slug, group);
  }
  return [...groups.values()].filter((g) => g.products.length === QUAD_SIZE).slice(0, max);
}
