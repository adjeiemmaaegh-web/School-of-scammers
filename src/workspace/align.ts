/**
 * Alignment and distribution of a selection (roadmap R6.2). Pure. Aligns part ORIGINS (the x/y stored in the project),
 * which is exact for the standard device footprint and a deliberate simplification for plant equipment of other sizes.
 * Results always lie between existing positions, so they stay on the floor.
 */
import type { PlacedComponent, XY } from '../sim/signals';

export type AlignMode = 'left' | 'right' | 'hcenter' | 'top' | 'bottom' | 'vcenter' | 'distribute-h' | 'distribute-v';
export const ALIGN_MODES: readonly AlignMode[] = ['left', 'right', 'hcenter', 'top', 'bottom', 'vcenter', 'distribute-h', 'distribute-v'];

export function alignedPositions(parts: readonly PlacedComponent[], mode: AlignMode): Map<string, XY> {
  if (!ALIGN_MODES.includes(mode)) throw new RangeError('Unknown alignment');
  const needed = mode.startsWith('distribute') ? 3 : 2;
  if (parts.length < needed) throw new Error(mode.startsWith('distribute') ? 'Select at least three devices to distribute' : 'Select at least two devices to align');
  const xs = parts.map(c => c.x), ys = parts.map(c => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const out = new Map<string, XY>(parts.map(c => [c.id, { x: c.x, y: c.y }]));
  const set = (c: PlacedComponent, patch: Partial<XY>) => out.set(c.id, { ...out.get(c.id)!, ...patch });
  switch (mode) {
    case 'left': parts.forEach(c => set(c, { x: minX })); break;
    case 'right': parts.forEach(c => set(c, { x: maxX })); break;
    case 'hcenter': parts.forEach(c => set(c, { x: Math.round((minX + maxX) / 2) })); break;
    case 'top': parts.forEach(c => set(c, { y: minY })); break;
    case 'bottom': parts.forEach(c => set(c, { y: maxY })); break;
    case 'vcenter': parts.forEach(c => set(c, { y: Math.round((minY + maxY) / 2) })); break;
    case 'distribute-h': case 'distribute-v': {
      const horizontal = mode === 'distribute-h';
      // Stable order by position then id, so ties distribute deterministically.
      const sorted = [...parts].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y) || a.id.localeCompare(b.id));
      const lo = horizontal ? minX : minY, hi = horizontal ? maxX : maxY;
      sorted.forEach((c, i) => set(c, horizontal ? { x: Math.round(lo + ((hi - lo) * i) / (sorted.length - 1)) } : { y: Math.round(lo + ((hi - lo) * i) / (sorted.length - 1)) }));
      break;
    }
  }
  return out;
}
