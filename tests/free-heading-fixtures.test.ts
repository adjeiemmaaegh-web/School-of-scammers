import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement, World } from '../src/plant/world/types';

const E = (id: string, kind: string, x: number, y: number, params: Record<string, number> = {}, headingDeg?: number): EquipmentPlacement =>
  ({ id, kind, originMm: vec(x, y, 0), yawDeg: 0, params, ...(headingDeg ? { headingDeg } : {}) });
const BELT = (heading = 0) => E('belt', 'belt-conveyor', 0, 0, { lengthMm: 2400, widthMm: 600, speedMmS: 400 }, heading);
const carried = (items: EquipmentPlacement[], x: number, y: number, scans: number, cmd: Record<string, Record<string, boolean | number>> = {}, carrier = 'belt'): SceneRuntime => {
  const w = spawnBody(freshWorld(), 't', { size: vec(80, 80, 60), massKg: 1, pos: vec(x, y, 120), supportedBy: carrier });
  let r = freshRuntime(w, items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { belt: { run: true }, ...cmd });
  return r;
};

describe('free heading: stoppers, gates, fences and doors block along their turned rectangle', () => {
  it('a stopper turned 45 degrees stops a part that its unturned rectangle would have let past', () => {
    // belt along +x; stopper across the belt at x = 300 (200 mm wide, 80 mm long when unturned)
    const stop = (heading: number | undefined, y: number) => carried([BELT(), E('s', 'stopper', 300, 0, {}, heading)], -200, y, 80, { s: { extend: true } }).world.bodies[0].pos.x;
    expect(stop(undefined, 0)).toBeLessThan(300);                                            // blocked head on
    expect(stop(undefined, 250)).toBeGreaterThan(400);                                       // beside the 220 mm long stopper: passes
    expect(stop(90, 0)).toBeLessThan(400);                                                   // turned to lie along the belt it is only 90 mm thick across y, but still in the way of a centred part
    expect(stop(45, 0)).toBeLessThan(330);                                                   // turned 45: still in the way
  });
  it('a stopper turned 90 degrees no longer reaches a part riding off to one side', () => {
    const at = (heading: number | undefined) => carried([BELT(), E('s', 'stopper', 300, 0, {}, heading)], -200, 70, 80, { s: { extend: true } }).world.bodies[0].pos.x;
    expect(at(undefined)).toBeLessThan(330);   // 200 mm across the belt reaches a part 70 mm off-centre
    expect(at(90)).toBeGreaterThan(400);       // turned, it is only 80 mm across: the part slips past
  });
  it('a part is held by a stopper turned to 90 degrees across a belt running along y', () => {
    const belt = E('belt', 'belt-conveyor', 0, 0, { lengthMm: 2400, widthMm: 600, speedMmS: 400 }, 90);
    const r = carried([belt, E('s', 'stopper', 0, 300, {}, 90)], 0, -200, 80, { s: { extend: true } });
    expect(r.world.bodies[0].pos.y).toBeLessThan(300);
    expect(r.world.bodies[0].pos.y).toBeGreaterThan(150);
  });
  it('a fence panel turned to a heading blocks a part at the turned face', () => {
    const fence = (heading?: number) => carried([BELT(), E('f', 'safety-fence', 400, 0, { lengthMm: 1000, widthMm: 100 }, heading)], -200, 0, 100).world.bodies[0].pos.x;
    expect(fence(undefined)).toBeLessThan(400);
    expect(fence(90)).toBeLessThan(400);                                                      // 1000 long panel turned 90: across x it is 100 thick, still blocks
    expect(fence(45)).toBeLessThan(400);
  });
  it('a walking person is stopped by the bounding box of a turned fence', () => {
    const person = (x: number, y: number, goal: { x: number; y: number }): World => ({
      ...freshWorld(),
      trainingOperator: { id: 'training-operator', shape: 'cylinder', size: vec(400, 400, 1800), massKg: 75, pos: vec(x, y, 0), yawDeg: 0, vel: vec(), supportedBy: null, tags: { material: 'person', training: true } },
      operatorGoal: goal,
    });
    const stop = (item: EquipmentPlacement) => { let r = freshRuntime(person(-2000, 0, { x: 2000, y: 0 }), [item], PLANT_EQUIPMENT); for (let i = 0; i < 160; i++) r = stepScene(r, [item], PLANT_EQUIPMENT, {}); return r.world.trainingOperator!.pos.x; };
    const flat = stop(E('f', 'safety-fence', 0, 0, { lengthMm: 1000, widthMm: 100 })), turned = stop(E('f', 'safety-fence', 0, 0, { lengthMm: 1000, widthMm: 100 }, 45));
    expect(Math.abs(flat + (500 + 200))).toBeLessThan(13);                                    // half of the 1000 mm panel plus the person's radius
    expect(Math.abs(turned + ((1000 + 100) * Math.SQRT1_2 / 2 + 200))).toBeLessThan(13);       // half the turned bounding box
    expect(turned).toBeGreaterThan(flat);                                                     // the turned panel is shorter along x, so the person gets closer
  });
});

describe('free heading: turntables and indexing tables', () => {
  it('an indexing table turned by a heading still carries its parts round its own centre and keeps its footprint', () => {
    const table = E('t', 'index-table', 0, 0, { stations: 4, indexMs: 500 }, 30);
    let w = spawnBody(freshWorld(), 'p', { size: vec(80, 80, 60), massKg: 1, pos: vec(300, 0, 120), supportedBy: 't' });
    let r = freshRuntime(w, [table], PLANT_EQUIPMENT);
    for (let i = 0; i < 40; i++) r = stepScene(r, [table], PLANT_EQUIPMENT, { t: { index: i >= 2 && i < 4 } });
    expect(r.signals.t.position).toBe(1);
    expect(r.world.bodies[0].pos.x).toBeCloseTo(0, 0); expect(r.world.bodies[0].pos.y).toBeCloseTo(300, 0);
    expect(r.world.bodies[0].supportedBy).toBe('t');                                          // still on the table after the quarter turn
  });
  it('a part riding a turned 800 x 800 table stays on it at a point only the turned square covers', () => {
    const table = E('t', 'index-table', 0, 0, { stations: 4 }, 45);
    // (380, 380) is outside the unturned 800 square on the diagonal (distance 537 > 400 per axis? no: 380 < 400) so use a far corner of the turned square
    const onTurned = carried([table], 0, 540, 3, {}, 't').world.bodies[0];
    expect(onTurned.supportedBy).toBe('t');                                                   // 540 mm along the turned diagonal axis is inside the turned square (half-diagonal 565)
    const unturned = carried([E('t', 'index-table', 0, 0, { stations: 4 })], 0, 540, 3, {}, 't').world.bodies[0];
    expect(unturned.supportedBy).toBeNull();                                                  // outside the unturned 800 square
  });
  it('a turntable with a free heading carries along its turned axis', () => {
    const tt = E('tt', 'turntable', 0, 0, {}, 45);
    const r = carried([tt], 0, 0, 25, { tt: { run: true } }, 'tt');
    const v = r.world.bodies[0].vel;
    expect(Math.hypot(v.x, v.y)).toBeGreaterThan(20);
    expect(v.x).toBeCloseTo(v.y, 0);
  });
});

describe('free heading: machine-guard cage', () => {
  const cage = (heading?: number, openSide = 0): EquipmentPlacement => E('g', 'machine-guard', 0, 0, { sizeMm: 1000, openSide }, heading);
  it('wall rectangles swing round the centre and carry the heading', async () => {
    const { guardWalls, insideWall } = await import('../src/plant/world/guard-walls');
    const walls = guardWalls(cage(90));
    expect(walls).toHaveLength(4);
    expect(walls.every(w => w.a === 90)).toBe(true);
    const top = walls.find(w => Math.abs(w.cx) < 1e-6 && w.cy > 400)!;     // the +x wall of an unturned cage is now on +y, running along x
    expect(top.cy).toBeCloseTo(470, 3);
    expect(insideWall(top, 480, 470)).toBe(true);
    expect(insideWall(top, 0, 520)).toBe(false);
    const w45 = guardWalls(cage(45))[0];
    expect(Math.hypot(w45.cx, w45.cy)).toBeCloseTo(470, 3);                // centres stay on the same circle
    expect(guardWalls(cage(undefined))[0].a).toBeUndefined();              // unturned cages are exactly as before
  });
  it('a part on an axis belt meets the turned cage at its corner, not at the unturned wall position', () => {
    const x = carried([BELT(), cage(45, 0)], -1100, 0, 160).world.bodies[0].pos.x;
    expect(x).toBeLessThan(-600); expect(x).toBeGreaterThan(-760);
  });
  it('a part on a belt along the turned axis is stopped by a closed cage and enters through the turned opening', () => {
    const run = (item: EquipmentPlacement) => carried([BELT(45), item], -565, -565, 160).world.bodies[0].pos.x;
    const stopped = run(cage(45, 0));                                      // closed: held at the turned wall face, 500 mm out along the belt (x = -354)
    expect(stopped).toBeLessThan(-300); expect(stopped).toBeGreaterThan(-400);
    const inside = run(cage(45, 3));                                       // opening on -x turned to face the belt
    expect(inside).toBeGreaterThan(0); expect(inside).toBeLessThan(400);   // through the opening, stopped by the far turned wall
  });
  it('a walking person is kept out by a turned wall and walks into the turned opening', () => {
    const walk = (item: EquipmentPlacement, from: { x: number; y: number }) => {
      const items = [item];
      const w: World = { ...freshWorld(), operatorGoal: { x: 0, y: 0 },
        trainingOperator: { id: 'training-operator', shape: 'cylinder', size: vec(400, 400, 1800), massKg: 75, pos: vec(from.x, from.y, 0), yawDeg: 0, vel: vec(), supportedBy: null, tags: { material: 'person', training: true } } };
      let r = freshRuntime(w, items, PLANT_EQUIPMENT);
      for (let i = 0; i < 300; i++) r = stepScene(r, items, PLANT_EQUIPMENT, {});
      return r.world.trainingOperator!.pos;
    };
    const corner = walk(cage(45, 0), { x: -1500, y: 0 });                    // head on into a corner of the turned cage
    expect(corner.x).toBeLessThan(-850);                                     // an unturned wall would have stopped the person near x = -700
    const from = { x: -1061, y: -1061 };                                   // on the opening's axis (225 degrees) of a cage turned 45
    const closed = walk(cage(45, 0), from);
    expect(Math.hypot(closed.x, closed.y)).toBeGreaterThan(500);
    const open = walk(cage(45, 3), from);
    expect(Math.hypot(open.x, open.y)).toBeLessThan(10);
  });
});

describe('pusher orientation (yaw fix) and free heading', () => {
  const run = (yawDeg: number, headingDeg: number | undefined, bodyAt: { x: number; y: number }) => {
    const item: EquipmentPlacement = { id: 'p', kind: 'pusher', originMm: vec(0, 0, 0), yawDeg: yawDeg as 0, params: {}, ...(headingDeg ? { headingDeg } : {}) };
    let r = freshRuntime(spawnBody(freshWorld(), 'b', { size: vec(80, 80, 60), massKg: 1, pos: vec(bodyAt.x, bodyAt.y, 30), supportedBy: null }), [item], PLANT_EQUIPMENT);
    for (let i = 0; i < 40; i++) r = stepScene(r, [item], PLANT_EQUIPMENT, { p: { extend: true } });
    return r.world.bodies[0].pos;
  };
  it('yaw 0 pushes along +y exactly as before', () => {
    const p = run(0, undefined, { x: 0, y: 0 });
    expect(p.x).toBe(0); expect(p.y).toBeGreaterThan(100);
  });
  it('a pusher turned 90 degrees pushes along -x (it used to push along +y whatever its yaw)', () => {
    const p = run(90, undefined, { x: 0, y: 0 });
    expect(p.x).toBeLessThan(-100); expect(Math.abs(p.y)).toBeLessThan(1);
  });
  it('a free heading of 45 degrees pushes diagonally and the ram zone turns with it', () => {
    const p = run(0, 45, { x: 0, y: 0 });
    expect(p.x).toBeLessThan(-60); expect(p.y).toBeGreaterThan(60); expect(p.x).toBeCloseTo(-p.y, 0);
    // a body inside the unturned 260 x 230 zone but outside the turned one is not pushed
    const outside = run(0, 45, { x: 125, y: 110 });
    expect(outside).toMatchObject({ x: 125, y: 110 });
  });
});

describe('platforms and stairs with a free heading', () => {
  const person = (x: number, y: number) => ({ x, y });
  it('a turned platform raises the floor only inside its turned rectangle, not its bounding box', async () => {
    const { floorHeightAt } = await import('../src/plant/world/operator-walk');
    const deck: EquipmentPlacement = { id: 'd', kind: 'platform', originMm: vec(0, 0, 0), yawDeg: 0, params: { lengthMm: 2000, widthMm: 400, heightMm: 900 }, headingDeg: 45 };
    const along = person(600 * Math.SQRT1_2, 600 * Math.SQRT1_2);          // 600 mm along the turned length
    expect(floorHeightAt([deck], along.x, along.y)).toBe(900);
    expect(floorHeightAt([deck], 600, -600)).toBe(0);                       // inside the bounding box, outside the deck
    expect(floorHeightAt([{ ...deck, headingDeg: undefined }], 600, 0)).toBe(900);   // unturned: unchanged behaviour
  });
  it('turned stairs rise toward their turned heading end', async () => {
    const { floorHeightAt } = await import('../src/plant/world/operator-walk');
    const run: EquipmentPlacement = { id: 's', kind: 'stairs', originMm: vec(0, 0, 0), yawDeg: 0, params: { lengthMm: 1800, widthMm: 900, heightMm: 900 }, headingDeg: 90 };
    expect(floorHeightAt([run], 0, 800)).toBeGreaterThan(800);             // near the +y end (heading 90)
    expect(floorHeightAt([run], 0, -800)).toBeLessThan(100);
    expect(floorHeightAt([run], 800, 0)).toBe(0);                           // beside the 900 mm wide run
  });
  it('the stair drawing sizes each step in its own frame and turns it with the run', () => {
    const drawings = PLANT_EQUIPMENT.stairs.describe(PLANT_EQUIPMENT.stairs.fresh({}), { id: 's', originMm: vec(0, 0, 0), yawDeg: 90, params: {} } as never);
    expect(drawings[0].size.x).toBeCloseTo(300, 6);                         // 1800 / 6 tread depth along the run
    expect(drawings[0].size.y).toBe(900);
    expect(drawings[0].yawDeg).toBe(90);
    expect(drawings[0].pos.y).toBeLessThan(drawings[5].pos.y);              // rising toward +y
  });
});
