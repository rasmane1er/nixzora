import 'server-only';
import { type CategoryNode } from '@nixzora/validation';
import { load } from './api';

export type Brand = { id: string; slug: string; name: string };
export type CategoryOption = { id: string; slug: string; label: string; isActive: boolean };

/** Category tree flattened for <select>s: "Computers › Laptops". */
export function flatten(nodes: CategoryNode[], trail: string[] = []): CategoryOption[] {
  return nodes.flatMap((node) => {
    const path = [...trail, node.name];
    return [
      { id: node.id, slug: node.slug, label: path.join(' › '), isActive: node.isActive },
      ...flatten(node.children, path),
    ];
  });
}

export async function catalogOptions() {
  const [tree, brands] = await Promise.all([
    load<CategoryNode[]>('/admin/categories'),
    load<Brand[]>('/admin/brands'),
  ]);
  return { tree, categories: flatten(tree), brands };
}
