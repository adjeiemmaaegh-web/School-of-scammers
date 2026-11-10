/** Immutable device selection for clicking, Ctrl/Meta-clicking and explicit group commands. */
import type { PlacedComponent } from '../sim/signals';

export const emptySelection = (): string[] => [];
export function selectOne(id: string | null): string[] { return id ? [id] : []; }
export function toggleOne(selected: readonly string[], id: string): string[] {
  return selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id];
}
export function selectAll(parts: readonly PlacedComponent[]): string[] { return parts.map(c => c.id); }
export function reconcileSelection(selected: readonly string[], parts: readonly PlacedComponent[]): string[] {
  const existing = new Set(parts.map(c => c.id));
  return [...new Set(selected)].filter(id => existing.has(id));
}
export function assertSelection(parts: readonly PlacedComponent[], ids: readonly string[]): PlacedComponent[] {
  if (!ids.length || ids.length > 60 || new Set(ids).size !== ids.length)
    throw new Error('Select 1–60 distinct devices');
  const found = ids.map(id => parts.find(c => c.id === id));
  if (found.some(c => !c)) throw new Error('A selected device is missing');
  return found as PlacedComponent[];
}
