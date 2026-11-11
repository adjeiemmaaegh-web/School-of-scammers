/**
 * A top-down projection of the SAME worker-owned 3D/PLC project.
 * Millimetres, geometry and parcel positions come from the P3 model. The plan
 * is an editing view, never an alternate simulation or a collision solver.
 */
import { PLANT_EQUIPMENT } from '../plant/equipment';
import type { ProjectFile, PlacedComponent, XY } from '../sim/signals';
import { clampPlacement, DEVICE_DEPTH, DEVICE_WIDTH } from './geometry';
import type { GridStep } from './types';

export const PLAN_WIDTH = 1080;
export const PLAN_DEPTH = 580;
export type PlanFootprint = {
  id: string;
  kind: string;
  x: number; y: number; width: number; depth: number;
  yawDeg: number; isPlant: boolean; isCarrier: boolean;
};
/** Only independent transport surfaces are checked for potential overlap.
 * Photoeyes intentionally mount in a transport footprint; they aren't collisions.
 */
const CARRIERS = new Set(['belt-conveyor', 'roller-conveyor', 'turntable', 'lift', 'scissor-lift']);
const finiteMm = (value: number): number => Number.isFinite(value) ? value : 0;
export function footprintOf(
  item: PlacedComponent, params: ProjectFile['params'] = {},
): PlanFootprint {
  const model = PLANT_EQUIPMENT[item.kind];
  const settings = params?.[item.id] ?? {};
  // Saved project x/y is the upper-left of a 170 × 130 legacy slot.
  // The P3 plant origin is the centre of that slot; one plan unit = 10 mm.
  const length = model ? finiteMm(settings.lengthMm ?? model.footprint.x) / 10 : 96;
  const depth = model ? finiteMm(settings.widthMm ?? model.footprint.y) / 10 : 57;
  const yawDeg = item.yawDeg ?? 0;
  const quarterTurn = yawDeg === 90 || yawDeg === 270;
  return {
    id: item.id, kind: item.kind,
    x: item.x + DEVICE_WIDTH / 2,
    y: item.y + DEVICE_DEPTH / 2,
    width: quarterTurn ? depth : length,
    depth: quarterTurn ? length : depth,
    yawDeg,
    isPlant: Boolean(model),
    isCarrier: CARRIERS.has(item.kind),
  };
}
/** Worker plant x/y are millimetres; the 3D canvas uses x/z as metres. */
export function workerToPlan(mmX: number, mmY: number): XY {
  // P3 placements and live bodies use the device CENTRE in millimetres.
  // Do not subtract the legacy device half-slot: that subtraction belongs
  // only to planToPlacement, which returns persisted top-left coordinates.
  return { x: finiteMm(mmX) / 10 + PLAN_WIDTH / 2,
    y: finiteMm(mmY) / 10 + PLAN_DEPTH / 2 };
}
/** Cursor is a plan CENTRE, but saved coordinates are device slot upper-left. */
export function planToPlacement(x: number, y: number, grid: GridStep): XY {
  return clampPlacement({ x: x - DEVICE_WIDTH / 2, y: y - DEVICE_DEPTH / 2 }, grid);
}
export type PlanOverlap = { first: string; second: string };
/** Advisory only: touching belts and deliberately intersecting transport are not
 * automatically illegal. The worker remains the only authority on movement.
 */
export function possibleCarrierOverlaps(items: readonly PlanFootprint[]): PlanOverlap[] {
  const carriers = items.filter(item => item.isCarrier);
  const warnings: PlanOverlap[] = [];
  for (let i = 0; i < carriers.length; i++) for (let j = i + 1; j < carriers.length; j++) {
    const a = carriers[i], b = carriers[j];
    const xOverlap = (a.width + b.width) / 2 - Math.abs(a.x - b.x);
    const yOverlap = (a.depth + b.depth) / 2 - Math.abs(a.y - b.y);
    if (xOverlap > 5 && yOverlap > 5)
      warnings.push({ first: a.id, second: b.id });
  }
  return warnings;
}
