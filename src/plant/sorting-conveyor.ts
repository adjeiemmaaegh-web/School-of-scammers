/** P3 bounded single-lane material flow. Pure, deterministic, fixed-scan educational
 * kinematics (NOT physical conveyor mechanics or factory-grade object detection).
 * Sensor and diverter coordinates actually influence behavior, not the renderer.
 */
import type { PlacedComponent } from '../sim/signals';

export type ParcelKind = 'marked' | 'plain';
export type ParcelRoute = 'approach' | 'accept' | 'reject';
export type Parcel = { id: number; kind: ParcelKind; position: number; route: ParcelRoute };
export type SortingPlant = {
  parcel: Parcel | null;
  lastParcelId: number;
  photoeyeActive: boolean;
  accepted: number;
  rejected: number;
};
export type PlantChange = { plant: SortingPlant; events: string[] };
export const freshPlant = (): SortingPlant => ({
  parcel: null, lastParcelId: 0, photoeyeActive: false, accepted: 0, rejected: 0,
});
const BELT_LENGTH_PX = 360;
const LIMIT = 10000;
/** Relative source geometry: belt runs from -180 to +180 pixels around its center.
 * Auxiliary devices must be close to the conveyor and on the correct part of the belt.
 */
export function stationPosition(conveyor: PlacedComponent | undefined,
  device: PlacedComponent | undefined): number | null {
  if (!conveyor || !device || Math.abs(device.y - conveyor.y) > 145) return null;
  const position = 0.5 + (device.x - conveyor.x) / BELT_LENGTH_PX;
  return position >= 0.08 && position <= 0.95 ? position : null;
}
export function feedPlant(plant: SortingPlant, kind: ParcelKind): PlantChange {
  if (kind !== 'marked' && kind !== 'plain') throw new Error('Unknown parcel type');
  if (plant.parcel) return { plant, events: ['Conveyor already contains a parcel; wait until discharge'] };
  if (plant.accepted + plant.rejected >= LIMIT) return { plant, events: ['Plant counter limit reached; reset scan state'] };
  const id = plant.lastParcelId + 1;
  return {
    plant: { ...plant, lastParcelId: id, parcel: { id, kind, position: 0, route: 'approach' }, photoeyeActive: false },
    events: [`Parcel ${id}: ${kind} package fed to conveyor`],
  };
}
export function stepPlant(
  prior: SortingPlant, components: readonly PlacedComponent[], beltOn: boolean,
  diverterOn: boolean, dtMs: number,
): PlantChange {
  const conveyor = components.find(c => c.kind === 'conveyor');
  const photoeye = components.find(c => c.kind === 'photoeye');
  const diverter = components.find(c => c.kind === 'diverter');
  const sensorAt = stationPosition(conveyor, photoeye);
  const diverterAt = stationPosition(conveyor, diverter);
  const validLayout = sensorAt !== null && diverterAt !== null && diverterAt >= sensorAt + 0.10;
  const parcel = prior.parcel;
  if (!conveyor || !parcel) return {
    plant: { ...prior, parcel: conveyor ? parcel : null, photoeyeActive: false }, events: [],
  };
  const position = beltOn ? Math.round((parcel.position + dtMs * 0.00064) * 1000000) / 1000000 : parcel.position;
  let route: ParcelRoute = parcel.route;
  const events: string[] = [];
  if (route === 'approach' && validLayout && beltOn && position >= diverterAt!) {
    route = diverterOn ? 'reject' : 'accept';
    events.push(`Parcel ${parcel.id}: ${route} route selected by wired diverter`);
  }
  // If the sorting actuators are not installed/aligned the package still exits
  // through the primary lane. No invisible automatic rejection is performed.
  if (route === 'approach' && position >= 1) {
    route = 'accept';
    events.push(`Parcel ${parcel.id}: normal discharge (no valid sorting station)`);
  }
  const sensorOn = validLayout && parcel.kind === 'marked' && route === 'approach' &&
    position >= sensorAt! - 0.015 && position <= Math.min(diverterAt! + 0.025, sensorAt! + 0.20);
  if (sensorOn !== prior.photoeyeActive)
    events.push(`Mark photoeye ${sensorOn ? 'detected' : 'cleared'} parcel ${parcel.id}`);
  if (position >= 1.1 && route !== 'approach') {
    events.push(`Parcel ${parcel.id}: ${route} discharge complete`);
    return { plant: {
      ...prior, parcel: null, photoeyeActive: false,
      accepted: prior.accepted + (route === 'accept' ? 1 : 0),
      rejected: prior.rejected + (route === 'reject' ? 1 : 0),
    }, events };
  }
  return {
    plant: { ...prior, parcel: { ...parcel, position, route }, photoeyeActive: sensorOn === true },
    events,
  };
}
