/**
 * Which devices belong together on the floor. A photoeye or diverter works on the conveyor it is
 * positioned along; a pump, drain valve or level switch works on the tank it is mounted beside. The rule
 * is geometric (the same rules the plant models already use), so the user builds a plant by placing things,
 * not by declaring links, and any number of conveyors and tanks can coexist.
 *
 * When a device is in range of several, the NEAREST one wins (ties go to the earlier component), so the
 * assignment is deterministic and does not depend on hidden state.
 */
import { stationPosition } from '../plant/sorting-conveyor';
import { tankMounted } from '../plant/tank-process';
import type { PlacedComponent } from './signals';

type Parts = readonly PlacedComponent[];
const distance = (a: PlacedComponent, b: PlacedComponent) => Math.hypot(a.x - b.x, a.y - b.y);

function nearest(candidates: PlacedComponent[], device: PlacedComponent): PlacedComponent | undefined {
  let best: PlacedComponent | undefined;
  for (const c of candidates) if (!best || distance(c, device) < distance(best, device)) best = c;
  return best;
}

/** The conveyor a photoeye or diverter is positioned along, or undefined if it is not on any belt. */
export function laneOf(components: Parts, device: PlacedComponent): PlacedComponent | undefined {
  return nearest(components.filter(c => c.kind === 'conveyor' && stationPosition(c, device) !== null), device);
}

/** Mount distances the tank model uses: level switch is closer-coupled than pump and valve. */
const MOUNT: Record<string, [number, number]> = { pump: [240, 200], drainvalve: [240, 200], levelprobe: [160, 160] };

/** The tank a pump, drain valve or level switch is mounted beside, or undefined. */
export function vesselOf(components: Parts, device: PlacedComponent): PlacedComponent | undefined {
  const [maxX, maxY] = MOUNT[device.kind] ?? [240, 200];
  return nearest(components.filter(c => c.kind === 'tank' && tankMounted(c, device, maxX, maxY)), device);
}

export type Lane = { conveyor: PlacedComponent; eyes: PlacedComponent[]; diverters: PlacedComponent[] };
export type Vessel = { tank: PlacedComponent; pumps: PlacedComponent[]; valves: PlacedComponent[]; probes: PlacedComponent[] };

/** Every conveyor with the photoeyes and diverters positioned along it. */
export function lanesOf(components: Parts): Lane[] {
  const lanes = components.filter(c => c.kind === 'conveyor').map(conveyor => ({ conveyor, eyes: [] as PlacedComponent[], diverters: [] as PlacedComponent[] }));
  for (const c of components) {
    if (c.kind !== 'photoeye' && c.kind !== 'diverter') continue;
    const owner = laneOf(components, c);
    const lane = lanes.find(l => l.conveyor === owner);
    if (lane) (c.kind === 'photoeye' ? lane.eyes : lane.diverters).push(c);
  }
  return lanes;
}

/** Every tank with the pumps, drain valves and level switches mounted beside it. */
export function vesselsOf(components: Parts): Vessel[] {
  const vessels = components.filter(c => c.kind === 'tank').map(tank => ({ tank, pumps: [] as PlacedComponent[], valves: [] as PlacedComponent[], probes: [] as PlacedComponent[] }));
  for (const c of components) {
    if (c.kind !== 'pump' && c.kind !== 'drainvalve' && c.kind !== 'levelprobe') continue;
    const owner = vesselOf(components, c);
    const vessel = vessels.find(v => v.tank === owner);
    if (vessel) (c.kind === 'pump' ? vessel.pumps : c.kind === 'drainvalve' ? vessel.valves : vessel.probes).push(c);
  }
  return vessels;
}
