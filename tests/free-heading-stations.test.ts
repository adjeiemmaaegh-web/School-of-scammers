import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { materialById, materialSpawn } from '../src/plant/world/materials';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement, World } from '../src/plant/world/types';

const station = (params: Record<string, number> = {}, headingDeg?: number): EquipmentPlacement =>
  ({ id: 'st', kind: 'process-station', originMm: vec(0, 0, 0), yawDeg: 0, params: { operation: 1, cycleMs: 400, lengthMm: 600, widthMm: 200, ...params }, ...(headingDeg ? { headingDeg } : {}) });
const belt: EquipmentPlacement = { id: 'belt', kind: 'belt-conveyor', originMm: vec(0, 0, 0), yawDeg: 0, params: { lengthMm: 2400, widthMm: 600 } };
const part = (x: number, y: number): World => spawnBody(freshWorld(), 't', materialSpawn(materialById('metal-workpiece')!, vec(x, y, 120), { supportedBy: 'belt' }));
const run = (item: EquipmentPlacement, x: number, y: number, scans = 40) => {
  let r = freshRuntime(part(x, y), [belt, item], PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, [belt, item], PLANT_EQUIPMENT, { st: { run: true } });
  return r;
};

describe('free heading for production stations', () => {
  it('an unrotated 600 x 200 station works on a part inside its frame and ignores one beside it', () => {
    expect(run(station(), 250, 0).world.model.st.count).toBe(1);
    expect(run(station(), 0, 150).world.model.st.count).toBe(0);                        // 150 mm sideways: outside the 200 mm width
  });
  it('turned 90 degrees by heading the frame is long in y: the same two points swap', () => {
    expect(run(station({}, 90), 250, 0).world.model.st.count).toBe(0);
    expect(run(station({}, 90), 0, 250).world.model.st.count).toBe(1);
  });
  it('turned 45 degrees it covers the diagonal and not the old axis: the frame is a true rotated rectangle', () => {
    expect(run(station({}, 45), 212, 212).world.model.st.count).toBe(1);               // 300 mm along the turned frame
    expect(run(station({}, 45), 250, 0).world.model.st.count).toBe(0);                 // 177 mm along but 177 mm across a 100 mm half-width
    expect(run(station({}, 45), 150, 0).world.model.st.count).toBe(0);
  });
  it('partPresent follows the turned frame too', () => {
    const present = (heading: number | undefined, x: number, y: number) => run(station({ operation: 4 }, heading), x, y, 3).signals.st.partPresent;
    expect(present(45, 212, 212)).toBe(true); expect(present(undefined, 212, 212)).toBe(false);
  });
  it('a turned station stops a walking person at the bounding box of its turned frame', () => {
    const person = (x: number, y: number, goal: { x: number; y: number }): World => ({
      ...freshWorld(),
      trainingOperator: { id: 'training-operator', shape: 'cylinder', size: vec(400, 400, 1800), massKg: 75, pos: vec(x, y, 0), yawDeg: 0, vel: vec(), supportedBy: null, tags: { material: 'person', training: true } },
      operatorGoal: goal,
    });
    const stop = (item: EquipmentPlacement) => { let r = freshRuntime(person(-2000, 0, { x: 2000, y: 0 }), [item], PLANT_EQUIPMENT); for (let i = 0; i < 160; i++) r = stepScene(r, [item], PLANT_EQUIPMENT, {}); return r.world.trainingOperator!.pos.x; };
    const flat = stop(station()), turned = stop(station({}, 45));
    const radius = 200;                                                                 // the operator's own radius
    const step = 13;                                                                    // one 10 ms walking step is 12 mm
    expect(Math.abs(flat + (300 + radius))).toBeLessThan(step);                         // 600 mm long frame: half 300
    expect(Math.abs(turned + ((600 + 200) * Math.SQRT1_2 / 2 + radius))).toBeLessThan(step);   // half of the turned bounding box, 283 mm
    expect(turned).toBeGreaterThan(flat);                                               // narrower along x than the flat frame, so it stops closer
  });
});
