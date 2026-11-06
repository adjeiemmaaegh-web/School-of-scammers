/** P3 bounded tank-process physics. One vessel, one inlet pump, one outlet valve.
 * No real hydraulics/pressure, no fluid conservation between independent scenes.
 * All motion is deterministic and computed on the existing worker scan.
 */
import type { PlacedComponent } from '../sim/signals';

export const TANK_CAPACITY_ML = 1000;
export const HIGH_TRIP_ML = 750;
export const HIGH_CLEAR_ML = 600;
export type TankProcess = {
  levelMl: number;
  highLevel: boolean;
  filledMl: number;
  drainedMl: number;
  spills: number;
};
export type TankChange = { tank: TankProcess; events: string[] };
export const freshTank = (): TankProcess => ({
  levelMl: 0, highLevel: false, filledMl: 0, drainedMl: 0, spills: 0,
});
/** Pumps/probes must be installed adjacent to the vessel to affect the process.
 * The electrical circuit is solved separately by the authoritative orchestrator.
 */
export function tankMounted(
  tank: PlacedComponent | undefined, component: PlacedComponent | undefined,
  maxX = 240, maxY = 200,
): boolean {
  return !!tank && !!component && Math.abs(component.x - tank.x) <= maxX &&
    Math.abs(component.y - tank.y) <= maxY;
}
const round = (n: number) => Math.round(n * 1000) / 1000;
/** Level detection is latched with 75% trip / 60% clear hysteresis.
 * A missing/misaligned sensor has no output, regardless of actual liquid level.
 */
export function stepTank(
  prior: TankProcess, components: readonly PlacedComponent[], pumpPowered: boolean,
  drainPowered: boolean, dtMs: number,
): TankChange {
  if (!Number.isSafeInteger(dtMs) || dtMs < 1 || dtMs > 1000)
    throw new RangeError('Invalid tank simulation timestep');
  const vessel = components.find(c => c.kind === 'tank');
  if (!vessel) return { tank: freshTank(), events: [] };
  const pump = components.find(c => c.kind === 'pump');
  const valve = components.find(c => c.kind === 'drainvalve');
  const probe = components.find(c => c.kind === 'levelprobe');
  const filling = pumpPowered && tankMounted(vessel, pump);
  const draining = drainPowered && tankMounted(vessel, valve);
  const nextFill = filling ? dtMs * 0.18 : 0; // 180 ml/s, illustrative
  const nextDrain = draining ? dtMs * 0.26 : 0; // 260 ml/s, illustrative
  const rawLevel = prior.levelMl + nextFill - nextDrain;
  const levelMl = round(Math.max(0, Math.min(TANK_CAPACITY_ML, rawLevel)));
  const filled = filling ? Math.min(nextFill, TANK_CAPACITY_ML - prior.levelMl + nextDrain) : 0;
  const drained = draining ? Math.min(nextDrain, prior.levelMl + nextFill) : 0;
  const highLevel = tankMounted(vessel, probe, 160, 160) &&
    (prior.highLevel ? levelMl > HIGH_CLEAR_ML : levelMl >= HIGH_TRIP_ML);
  const events: string[] = [];
  if (prior.highLevel !== highLevel)
    events.push(`Tank level switch ${highLevel ? 'HIGH' : 'CLEAR'} at ${levelMl} ml`);
  const overCapacity = filling && rawLevel > TANK_CAPACITY_ML;
  if (overCapacity && prior.levelMl < TANK_CAPACITY_ML)
    events.push('Tank reached maximum capacity (bounded model, no spill volume)');
  return { tank: {
    levelMl,
    highLevel,
    filledMl: round(prior.filledMl + Math.max(0, filled)),
    drainedMl: round(prior.drainedMl + Math.max(0, drained)),
    spills: prior.spills + (overCapacity && prior.levelMl < TANK_CAPACITY_ML ? 1 : 0),
  }, events };
}
