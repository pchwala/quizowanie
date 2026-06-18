import { type Category } from '../types/api';

/**
 * Flatten categories into selectable options with parent-prefixed labels
 * (e.g. "Historia: Polska"). Parents with no children appear on their own.
 */
export function buildCategoryOptions(cats: Category[]): { id: string; label: string }[] {
  const childrenOf = new Map<string, Category[]>();
  for (const c of cats) {
    if (c.parent_id) {
      const list = childrenOf.get(c.parent_id) ?? [];
      list.push(c);
      childrenOf.set(c.parent_id, list);
    }
  }
  const result: { id: string; label: string }[] = [];
  const parents = cats
    .filter((c) => c.parent_id === null)
    .sort((a, b) => a.name.localeCompare(b.name, 'pl'));
  for (const parent of parents) {
    const children = (childrenOf.get(parent.id) ?? []).sort((a, b) =>
      a.name.localeCompare(b.name, 'pl'),
    );
    if (children.length === 0) {
      result.push({ id: parent.id, label: parent.name });
    } else {
      for (const child of children) {
        result.push({ id: child.id, label: `${parent.name}: ${child.name}` });
      }
    }
  }
  return result;
}
