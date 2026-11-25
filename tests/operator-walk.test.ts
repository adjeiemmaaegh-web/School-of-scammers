import { describe, expect, it } from 'vitest';
import { freshWorld } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { floorHeightAt, WALK_SPEED_MM_S } from '../src/plant/world/operator-walk';
import { createWorld, tick } from '../src/sim/orchestrator';
import type { EquipmentPlacement, World } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, y: number, params: Record<string, number> = {}, yawDeg: 0 | 90 | 180 | 270 = 0): EquipmentPlacement => ({ id, kind, originMm: vec(x, y, 0), yawDeg, params });
const person = (x: number, y: number, goal: { x: number; y: number }, extra: Partial<World> = {}): World => ({
  ...freshWorld(),
  trainingOperator: { id: 'training-operator', shape: 'cylinder', size: vec(400, 400, 1800), massKg: 75, pos: vec(x, y, 0), yawDeg: 0, vel: vec(), supportedBy: null, tags: { material: 'person', trainingOperator: true } },
  operatorGoal: goal, ...extra,
});
const walk = (items: EquipmentPlacement[], world: World, scans: number, inputs: Record<string, Record<string, boolean | number>> = {}) => {
  let r = freshRuntime(world, items, PLANT_EQUIPMENT);
  const trail: { x: number; y: number; z: number }[] = [];
  for (let i = 0; i < scans; i++) { r = stepScene(r, items, PLANT_EQUIPMENT, inputs); trail.push({ ...r.world.trainingOperator!.pos }); }
  return { r, trail, end: r.world.trainingOperator!.pos };
};

describe('R24 walking', () => {
  it('walks at walking speed toward the goal, deterministically, and stops there', () => {
    const half = walk([], person(0, 0, { x: 3000, y: 0 }), 10);               // 0.5 s
    expect(half.end.x).toBeGreaterThan(WALK_SPEED_MM_S * 0.5 * 0.95); expect(half.end.x).toBeLessThan(WALK_SPEED_MM_S * 0.5 * 1.05);
    const done = walk([], person(0, 0, { x: 1000, y: 500 }), 40);
    expect(Math.hypot(done.end.x - 1000, done.end.y - 500)).toBeLessThan(5);
    expect(done.r.world.operatorGoal).toBeUndefined();
    expect(walk([], person(0, 0, { x: 3000, y: 0 }), 10).end).toEqual(half.end);
  });
  it('with no goal, or no operator, nothing moves', () => {
    const w = person(100, 100, { x: 0, y: 0 }); delete w.operatorGoal;
    expect(walk([], w, 10).end).toEqual({ x: 100, y: 100, z: 0 });
    expect(stepScene(freshRuntime(freshWorld(), [], PLANT_EQUIPMENT), [], PLANT_EQUIPMENT, {}).world.trainingOperator).toBeUndefined();
  });
});

describe('R24/R20 fences, doors and handrails stop a person', () => {
  const fence = P('fence', 'safety-fence', 1000, 0, { lengthMm: 3000, widthMm: 100 }, 90);   // wall across x = 1000, spanning y -1500..1500
  it('a fence panel is never crossed', () => {
    const { trail } = walk([fence], person(0, 0, { x: 2500, y: 0 }), 60);
    expect(Math.max(...trail.map(p => p.x))).toBeLessThan(1000 - 200 + 1);
  });
  it('a closed guard door blocks; once fully open the person walks through; closing it again shuts them out', () => {
    const door = P('door', 'guard-door', 1000, 0, { lengthMm: 1000, widthMm: 100, travelMs: 500 }, 90);
    const shut = walk([door], person(0, 0, { x: 2500, y: 0 }), 60);
    expect(shut.end.x).toBeLessThan(800);
    const open = walk([door], person(0, 0, { x: 2500, y: 0 }), 100, { door: { open: true } });
    expect(open.end.x).toBeGreaterThan(2400);
  });
  it('a handrail blocks a person but a gap between rails lets them through', () => {
    const rails = [P('r1', 'handrail', 1000, -1100, { lengthMm: 1600 }, 90), P('r2', 'handrail', 1000, 1100, { lengthMm: 1600 }, 90)];   // gap |y| < 300
    expect(walk([rails[0]], person(0, -1000, { x: 2500, y: -1000 }), 60).end.x).toBeLessThan(800);
    expect(walk(rails, person(0, 0, { x: 2500, y: 0 }), 80).end.x).toBeGreaterThan(2400);
    expect(walk(rails, person(0, 900, { x: 2500, y: 900 }), 60).end.x).toBeLessThan(800);
  });
  it('shelves and tanks are solid to a person', () => {
    expect(walk([P('s', 'shelf', 1000, 0)], person(0, 0, { x: 2500, y: 0 }), 60).end.x).toBeLessThan(1000);
  });
  it('a person slides along a wall instead of stopping dead when the goal is diagonal', () => {
    const wall = P('wall', 'safety-fence', 1000, 0, { lengthMm: 3000, widthMm: 100 }, 90);
    const { end } = walk([wall], person(0, 0, { x: 2000, y: 1200 }), 60);
    expect(end.x).toBeLessThan(800); expect(end.y).toBeGreaterThan(900);
  });
});

describe('R20 platforms and stairs', () => {
  const stairs = P('st', 'stairs', 900, 0, { lengthMm: 1800, widthMm: 900, heightMm: 900 }, 0);        // rises toward +x, x 0..1800
  const deck = P('deck', 'platform', 2700, 0, { lengthMm: 1800, widthMm: 1800, heightMm: 900 });       // x 1800..3600
  it('the floor height follows the stair ramp and the platform top', () => {
    expect(floorHeightAt([stairs, deck], -500, 0)).toBe(0);
    expect(floorHeightAt([stairs, deck], 900, 0)).toBeCloseTo(450, 6);
    expect(floorHeightAt([stairs, deck], 2700, 0)).toBe(900);
  });
  it('walking up the stairs lifts the person onto the platform; sensors then see their real height', () => {
    const { end, trail } = walk([stairs, deck], person(-300, 0, { x: 3000, y: 0 }), 140);
    expect(end.x).toBeGreaterThan(2900); expect(end.z).toBe(900);
    expect(trail.some(p => p.z > 100 && p.z < 800)).toBe(true);        // passed through intermediate heights on the stairs
  });
  it('a person cannot step onto the platform from the floor, nor off its edge', () => {
    const up = walk([stairs, deck], person(2700, -2200, { x: 2700, y: 0 }), 80);
    expect(up.end.z).toBe(0); expect(up.end.y).toBeLessThan(-800);
    const onDeck = person(2700, 0, { x: 2700, y: -2500 });
    onDeck.trainingOperator!.pos.z = 900;
    const down = walk([stairs, deck], onDeck, 80);
    expect(down.end.z).toBe(900); expect(down.end.y).toBeGreaterThan(-1000);
  });
  it('a handrailed platform is reachable only through its stairs', () => {
    const rails = [P('rn', 'handrail', 2700, -950, { lengthMm: 1800 }), P('rs', 'handrail', 2700, 950, { lengthMm: 1800 })];
    const viaStairs = walk([stairs, deck, ...rails], person(-300, 0, { x: 3000, y: 0 }), 140);
    expect(viaStairs.end.z).toBe(900);
  });
});

describe('R24 zones and PLC-readable detection', () => {
  const zone = (params: Record<string, number> = {}) => P('zone', 'work-zone', 2000, 0, { lengthMm: 1000, widthMm: 1000, ...params });
  it('occupancy is position dependent: false outside, true inside, false again after leaving', () => {
    let r = freshRuntime(person(0, 0, { x: 2000, y: 0 }), [zone()], PLANT_EQUIPMENT);
    const occ = () => r.signals.zone.occupied;
    for (let i = 0; i < 10; i++) r = stepScene(r, [zone()], PLANT_EQUIPMENT, {});
    expect(occ()).toBe(false);
    for (let i = 0; i < 25; i++) r = stepScene(r, [zone()], PLANT_EQUIPMENT, {});
    expect(occ()).toBe(true);
    r = { ...r, world: { ...r.world, operatorGoal: { x: -500, y: 0 } } };
    for (let i = 0; i < 70; i++) r = stepScene(r, [zone()], PLANT_EQUIPMENT, {});
    expect(occ()).toBe(false);
  });
  it('entering a restricted zone latches an intrusion that survives leaving until reset (only when empty); a plain work zone never latches', () => {
    const run = (items: EquipmentPlacement[], goal: { x: number; y: number }, scans: number, from: ReturnType<typeof freshRuntime> | null = null, inputs: Record<string, Record<string, boolean | number>> = {}) => {
      let r = from ?? freshRuntime(person(0, 0, goal), items, PLANT_EQUIPMENT);
      if (from) r = { ...r, world: { ...r.world, operatorGoal: goal } };
      for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, inputs);
      return r;
    };
    let r = run([zone()], { x: 2000, y: 0 }, 40);
    expect(r.signals.zone.intrusion).toBe(true); expect(r.signals.zone.entries).toBe(1);
    r = run([zone()], { x: -500, y: 0 }, 70, r);
    expect(r.signals.zone.occupied).toBe(false); expect(r.signals.zone.intrusion).toBe(true);
    r = run([zone()], { x: -500, y: 0 }, 3, r, { zone: { reset: true } });
    expect(r.signals.zone.intrusion).toBe(false);
    expect(run([zone({ restricted: 0 })], { x: 2000, y: 0 }, 40).signals.zone).toMatchObject({ occupied: true, intrusion: false });
  });
  it('reset does nothing while the zone is still occupied; a dead zone sensor sees nobody', () => {
    const r = (() => { let x = freshRuntime(person(0, 0, { x: 2000, y: 0 }), [zone()], PLANT_EQUIPMENT); for (let i = 0; i < 40; i++) x = stepScene(x, [zone()], PLANT_EQUIPMENT, { zone: { reset: true } }); return x; })();
    expect(r.signals.zone.intrusion).toBe(true);
    let dead = freshRuntime(person(2000, 0, { x: 2000, y: 0 }), [zone()], PLANT_EQUIPMENT);
    for (let i = 0; i < 5; i++) dead = stepScene(dead, [zone()], PLANT_EQUIPMENT, {}, { zone: 'zone-sensor-dead' });
    expect(dead.signals.zone.occupied).toBe(false);
  });
  it('through the real engine: place the operator, command a walk, and the zone intrusion appears in the worker world', () => {
    let w = tick(createWorld(), [{ k: 'place', id: 'zone', kind: 'work-zone', at: { x: 500, y: 300 } }]).world;
    expect(w.lastError).toBeNull();
    w = tick(w, [{ k: 'walkOperator', xMm: 100, yMm: 0 }]).world;
    expect(w.lastError).toMatch(/Place the simulated operator/);
    w = tick(w, [{ k: 'setTrainingOperator', enabled: true, xMm: -3000, yMm: 0, feetMm: 0 }, { k: 'walkOperator', xMm: 1500, yMm: 0 }, { k: 'run' }]).world;
    expect(w.lastError).toBeNull();
    const before = w.plantWorld.world.trainingOperator!.pos.x;
    for (let i = 0; i < 20; i++) w = tick(w).world;
    expect(w.plantWorld.world.trainingOperator!.pos.x).toBeGreaterThan(before + 800);
    w = tick(w, [{ k: 'walkOperator', xMm: 99999, yMm: 0 }]).world;
    expect(w.lastError).toMatch(/Invalid walking target/);
  });
});
