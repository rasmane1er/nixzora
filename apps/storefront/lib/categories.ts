import { type CategoryNode } from '@nixzora/validation';

export function findCategory(
  nodes: CategoryNode[],
  slug: string,
): { node: CategoryNode; trail: CategoryNode[] } | null {
  for (const node of nodes) {
    if (node.slug === slug) return { node, trail: [node] };
    const inner = findCategory(node.children, slug);
    if (inner) return { node: inner.node, trail: [node, ...inner.trail] };
  }
  return null;
}

export function countProducts(node: CategoryNode): number {
  return node.productCount + node.children.reduce((sum, child) => sum + countProducts(child), 0);
}
