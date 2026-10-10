export type DropPosition = "before" | "after";

/** Returns a new array with the item at `fromIndex` moved to `toIndex` (both clamped to the list). */
export function moveItem<T>(items: readonly T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || fromIndex >= items.length) return [...items];
  const target = Math.max(0, Math.min(items.length - 1, toIndex));
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(target, 0, moved);
  return next;
}

/**
 * Where an item dragged from `fromIndex` ends up when dropped before/after the
 * item at `overIndex`, as an index into the list *after* the move.
 */
export function dropIndex(fromIndex: number, overIndex: number, position: DropPosition): number {
  const insertAt = position === "before" ? overIndex : overIndex + 1;
  return fromIndex < insertAt ? insertAt - 1 : insertAt;
}
