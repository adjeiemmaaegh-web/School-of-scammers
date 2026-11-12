/** Geometry and quarter-turn transforms in legacy saved-project workspace units. */
import type { XY, PlacedComponent } from '../sim/signals';
import type { GridStep } from './types';

export const WORKSPACE_WIDTH = 1080;
export const WORKSPACE_DEPTH = 580;
export const DEVICE_WIDTH = 170;
export const DEVICE_DEPTH = 130;
export const MIN_POSITION: XY = { x: 0, y: 0 };
export const MAX_POSITION: XY = { x: WORKSPACE_WIDTH - DEVICE_WIDTH, y: WORKSPACE_DEPTH - DEVICE_DEPTH };
export const GRID_STEPS: readonly GridStep[] = [1, 5, 10, 25, 50];

export const finite = (n: number): boolean => Number.isFinite(n);
export function clamp(n: number, lo: number, hi: number): number {
  if (!finite(n)) throw new RangeError('Non-finite workspace coordinate');
  return Math.max(lo, Math.min(hi, n));
}
export function snap(n: number, step: GridStep): number {
  if (!GRID_STEPS.includes(step)) throw new RangeError('Unsupported grid interval');
  return Math.round(n / step) * step;
}
export function clampPlacement(pos: XY, grid: GridStep = 5): XY {
  return {
    x: clamp(snap(pos.x, grid), MIN_POSITION.x, MAX_POSITION.x),
    y: clamp(snap(pos.y, grid), MIN_POSITION.y, MAX_POSITION.y),
  };
}
export function boundedGroupDelta(parts: readonly PlacedComponent[], delta: XY, grid: GridStep): XY {
  if (!parts.length) throw new Error('Select at least one device');
  if (!finite(delta.x) || !finite(delta.y)) throw new RangeError('Invalid movement');
  const xs = parts.map(p => p.x), ys = parts.map(p => p.y);
  const lowX = -Math.min(...xs), highX = MAX_POSITION.x - Math.max(...xs);
  const lowY = -Math.min(...ys), highY = MAX_POSITION.y - Math.max(...ys);
  if (lowX > highX || lowY > highY) throw new RangeError('Device group does not fit the floor');
  return {
    x: clamp(snap(delta.x, grid), lowX, highX),
    y: clamp(snap(delta.y, grid), lowY, highY),
  };
}
export function turn(yawDeg: number = 0, turns: -1 | 1): 0 | 90 | 180 | 270 {
  if (!Number.isInteger(yawDeg) || ![0, 90, 180, 270].includes(yawDeg))
    throw new RangeError('Only quarter-turn orientation is supported');
  return (((yawDeg + turns * 90 + 360) % 360) as 0 | 90 | 180 | 270);
}
export function rotateFloorOffset(offset: { x: number; z: number }, yawDeg: number): { x: number; z: number } {
  const turns = (((yawDeg % 360) + 360) % 360) / 90;
  switch (turns) {
    case 0: return { ...offset };
    case 1: return { x: -offset.z, z: offset.x };
    case 2: return { x: -offset.x, z: -offset.z };
    case 3: return { x: offset.z, z: -offset.x };
    default: throw new RangeError('Only quarter-turn orientation is supported');
  }
}
