/** Category tree walks on rows already loaded (the whole table is small). Unit-tested. */

/** Deeper than any real department tree; also stops a corrupted parent loop. */
export const MAX_CATEGORY_DEPTH = 20;

type Node = { id: string; parentId: string | null };

/** The category's parents, nearest first (not including the category itself). */
export function ancestorsOf<T extends Node>(id: string, byId: ReadonlyMap<string, T>): T[] {
  const chain: T[] = [];
  let parentId = byId.get(id)?.parentId ?? null;
  while (parentId && chain.length < MAX_CATEGORY_DEPTH) {
    const parent = byId.get(parentId);
    if (!parent || parent.id === id) break;
    chain.push(parent);
    parentId = parent.parentId;
  }
  return chain;
}

/** The category and everything under it, breadth first. */
export function descendantIds(rootId: string, categories: readonly Node[]): string[] {
  const ids = [rootId];
  const seen = new Set(ids);
  for (let i = 0; i < ids.length; i++) {
    for (const child of categories) {
      if (child.parentId === ids[i] && !seen.has(child.id)) {
        seen.add(child.id);
        ids.push(child.id);
      }
    }
  }
  return ids;
}
