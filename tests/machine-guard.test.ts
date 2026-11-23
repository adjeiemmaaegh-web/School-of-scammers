import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { guardWalls } from '../src/plant/world/guard-walls';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement, World } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, y: number, params: Record<string, number> = {}, yawDeg: 0 | 90 | 180 | 270 = 0): EquipmentPlacement => ({ id, kind, originMm: vec(x, y, 0), yawDeg, params });
const guard = (params: Record<string, number> = {}, yawDeg: 0 | 90 | 180 | 270 = 0) => P('g', 'machine-guard', 0, 0, { sizeMm: 1000, ...params }, yawDeg);
const person = (x: number, y: number, goal: { x: number; y: number }): World => ({
  ...freshWorld(),
  trainingOperator: { id: 'training-operator', shape: 'cylinder', size: vec(400, 400, 1800), massKg: 75, pos: vec(x, y, 0), yawDeg: 0, vel: vec(), supportedBy: null, tags: { material: 'person', training: true } },
  operatorGoal: goal,
});
const walk = (items: EquipmentPlacement[], w: World, scans = 120) => { let r = freshRuntime(w, items, PLANT_EQUIPMENT); for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, {}); return r.world.trainingOperator!.pos; };
/** A part on a long belt through the cage centre, running +x or +y, starting at `start` mm along the belt axis. */
function carry(items: EquipmentPlacement[], dir: 'x' | 'y', start: number, scans = 200): SceneRuntime {
  const belt = P('belt', 'belt-conveyor', 0, 0, { lengthMm: 2400, speedMmS: 400 }, dir === 'x' ? 0 : 90);
  const all = [belt, ...items];
  const w = spawnBody(freshWorld(), 't', { size: vec(100, 100, 100), massKg: 1, pos: dir === 'x' ? vec(start, 0, 120) : vec(0, start, 120), supportedBy: 'belt' });
  let r = freshRuntime(w, all, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, all, PLANT_EQUIPMENT, { belt: { run: true } });
  return r;
}
const where = (r: SceneRuntime) => r.world.bodies[0].pos;

describe('R20 machine guard cage', () => {
  it('geometry: four walls closed, three with an open side, and the opening turns with the placement', () => {
    expect(guardWalls(guard({ openSide: 0 }))).toHaveLength(4);
    expect(guardWalls(guard({ openSide: 1 }))).toHaveLength(3);
    expect(guardWalls(guard({ openSide: 1 })).some(w => w.cx > 400)).toBe(false);          // no wall on +x
    expect(guardWalls(guard({ openSide: 1 }, 90)).some(w => w.cy > 400)).toBe(false);      // opening turned to +y
    expect(guardWalls(guard({ openSide: 3 }, 0)).some(w => w.cx < -400)).toBe(false);      // opening on -x
    expect(guardWalls(guard({ openSide: 1 }, 180)).some(w => w.cx < -400)).toBe(false);    // +x opening turned to -x
    expect(guardWalls(guard({ openSide: 0, thicknessMm: 100 }))[0]).toEqual({ cx: 450, cy: 0, w: 100, d: 1000 });   // inside the outer edge
  });
  it('a part inside the cage leaves through the open side but is stopped by a closed wall', () => {
    expect(where(carry([guard({ openSide: 1 })], 'x', -300)).x).toBeGreaterThan(700);        // out through +x
    const closed = where(carry([guard({ openSide: 0 })], 'x', -300)).x;
    expect(closed).toBeLessThan(450); expect(closed).toBeGreaterThan(250);                    // held just inside the +x wall
    const wrongWay = where(carry([guard({ openSide: 3 })], 'x', -300)).x;                    // opening on -x: the +x wall stops it
    expect(wrongWay).toBeLessThan(450);
  });
  it('material cannot cross the closed sides: a belt along y is stopped at the cage wall', () => {
    const y = where(carry([guard({ openSide: 1 })], 'y', -1100)).y;
    expect(y).toBeLessThan(-400); expect(y).toBeGreaterThan(-560);                             // held outside the -y wall
    const turned = where(carry([guard({ openSide: 1 }, 90)], 'y', -1100)).y;                   // opening turned to +y: the -y wall remains
    expect(turned).toBeLessThan(-400);
    const free = where(carry([guard({ openSide: 4 })], 'y', -1100)).y;                         // opening on -y: it enters, and the +y wall stops it
    expect(free).toBeGreaterThan(-300); expect(free).toBeLessThan(450);
  });
  it('without a guard the part runs the whole belt (the walls are what stops it)', () => {
    expect(where(carry([], 'x', -300)).x).toBeGreaterThan(700);
  });
  it('the walking operator is stopped by the walls and can walk in through the open side', () => {
    const stopped = walk([guard({ openSide: 0 })], person(-1500, 0, { x: 0, y: 0 }));
    expect(stopped.x).toBeLessThan(-500);                                                      // held outside the -x wall
    const through = walk([guard({ openSide: 3 })], person(-1500, 0, { x: 0, y: 0 }));
    expect(Math.hypot(through.x, through.y)).toBeLessThan(10);                                 // in through the opening
    const sideOn = walk([guard({ openSide: 3 })], person(0, -1500, { x: 0, y: 0 }));
    expect(sideOn.y).toBeLessThan(-500);                                                       // the -y wall is solid
  });
  it('an unset opening defaults to +x, exactly as the setting shows (three walls, none on +x)', () => {
    const walls = guardWalls(P('g', 'machine-guard', 0, 0, { sizeMm: 1000 }));
    expect(walls).toHaveLength(3); expect(walls.some(w => w.cx > 400)).toBe(false);
  });
  it('wall thickness and cage size settings take effect', () => {
    const small = guardWalls(P('g', 'machine-guard', 0, 0, { sizeMm: 600, openSide: 0 }));
    expect(small[0].cx).toBeCloseTo(270, 6);
    expect(guardWalls(P('g', 'machine-guard', 0, 0, { sizeMm: 600, thicknessMm: 200, openSide: 0 }))[0].w).toBe(200);
  });
});
