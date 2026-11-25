import { describe, expect, it } from 'vitest';
import { conserved, freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { materialById, materialSpawn } from '../src/plant/world/materials';
import type { EquipmentPlacement, SpawnSpecLike } from './inclined-types';

const belt = (inclineDeg: number, extra: Record<string, number> = {}): EquipmentPlacement =>
  ({ id: 'belt', kind: 'belt-conveyor', originMm: vec(0, 0, 0), yawDeg: 0, params: { lengthMm: 1200, widthMm: 300, speedMmS: 300, inclineDeg, ...extra } });
const load = (tags: Record<string, string | number | boolean>, x = -450): SpawnSpecLike =>
  ({ size: vec(100, 100, 80), massKg: 2, pos: vec(x, 0, 120), supportedBy: 'belt', tags });
const run = (items: EquipmentPlacement[], spec: SpawnSpecLike, scans: number, inputs: Record<string, Record<string, boolean | number>> = { belt: { run: true } }) => {
  let r = freshRuntime(spawnBody(freshWorld(), 'test', spec), items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, inputs);
  return r;
};
const first = (r: ReturnType<typeof run>) => r.world.bodies[0];
const CARTON = { material: 'carton', frictionMu: 0.45 }, BOTTLE = { material: 'bottle-glass', frictionMu: 0.25 };

describe('R03 inclined belt conveyor', () => {
  it('a flat belt (incline 0) is unchanged and the setting is bounded 0-30 degrees', () => {
    const r = run([belt(0)], load(CARTON), 6);
    expect(first(r).pos.z).toBe(120);
    expect(() => run([belt(35)], load(CARTON), 1)).toThrow(/Invalid plant parameter inclineDeg/);
    expect(() => run([belt(12)], load(CARTON), 1)).toThrow(/Invalid plant parameter inclineDeg/); // steps of 5
  });
  it('cargo rises with the ramp: height tracks distance times tan(angle)', () => {
    const r = run([belt(15)], load(CARTON), 20);
    const b = first(r);
    const along = b.pos.x - (0 - 1200 / 2);
    expect(b.pos.x).toBeGreaterThan(-300);
    expect(Math.abs(b.pos.z - (120 + along * Math.tan(15 * Math.PI / 180)))).toBeLessThan(2); // within one substep of the ramp
    expect(b.pos.z).toBeGreaterThan(150);
  });
  it('friction decides who climbs: at 15 degrees a carton climbs and a glass bottle slides back', () => {
    const carton = first(run([belt(15)], load(CARTON), 24));
    const bottle = first(run([belt(15)], load(BOTTLE, -300), 24));
    expect(carton.pos.x).toBeGreaterThan(-300);
    // the bottle (mu 0.25 < tan 15 = 0.268) ends up lower than it started, behind its start, or off the belt altogether
    expect(bottle.pos.x).toBeLessThan(-300);
  });
  it('at 10 degrees the same bottle climbs (mu 0.25 > tan 10 = 0.176): the threshold is physical, not arbitrary', () => {
    const bottle = first(run([belt(10)], load(BOTTLE, -300), 24));
    expect(bottle.pos.x).toBeGreaterThan(-300);
  });
  it('a body with no friction coefficient uses the legacy equivalent (about 0.357): it climbs at 15 and slides at 25 degrees', () => {
    expect(first(run([belt(15)], load({ material: 'cardboard' }, -300), 24)).pos.x).toBeGreaterThan(-300);
    expect(first(run([belt(25)], load({ material: 'cardboard' }, -300), 24)).pos.x).toBeLessThan(-300);
  });
  it('a stopped belt still holds a high-friction load but cannot hold a slippery one', () => {
    const items = [belt(15)];
    const heldCarton = first(run(items, load(CARTON, -100), 20, { belt: { run: false } }));
    const slidBottle = first(run(items, load(BOTTLE, -100), 20, { belt: { run: false } }));
    expect(heldCarton.pos.x).toBeCloseTo(-100, 0);
    expect(slidBottle.pos.x).toBeLessThan(-100);
  });
  it('reverse run carries the load downhill', () => {
    const b = first(run([belt(15)], load(CARTON, 100), 12, { belt: { run: true, reverse: true } }));
    expect(b.pos.x).toBeLessThan(100);
  });
  it('downhill is helped by gravity: a reverse run on a slope reaches belt speed sooner than on a flat belt', () => {
    const down = first(run([belt(15)], load(CARTON, 100), 3, { belt: { run: true, reverse: true } }));
    const flat = first(run([belt(0)], load(CARTON, 100), 3, { belt: { run: true, reverse: true } }));
    expect(100 - down.pos.x).toBeGreaterThan(100 - flat.pos.x);
  });
  it('a load that is already high on the ramp is picked up by the ramp surface, not dropped to the floor', () => {
    const high = vec(300, 0, 120 + (300 + 600) * Math.tan(15 * Math.PI / 180)); // on the surface near the top end
    const r = run([belt(15)], { size: vec(100, 100, 80), massKg: 2, pos: high, tags: CARTON }, 1);
    // after ONE scan it is already carried by the ramp (not dipping towards the floor first)
    expect(first(r).supportedBy).toBe('belt');
    expect(Math.abs(first(r).pos.z - high.z)).toBeLessThan(3);
  });
  it('the belt drawing tilts so the 3D view matches the physics, and a flat belt does not', () => {
    const def = PLANT_EQUIPMENT['belt-conveyor'];
    const ctx = (inclineDeg: number) => ({ id: 'b', originMm: vec(0, 0, 0), yawDeg: 0 as const, params: { lengthMm: 1200, inclineDeg } });
    const flat = def.describe(def.fresh({}), ctx(0))[0], tilted = def.describe(def.fresh({}), ctx(20))[0];
    expect(flat.pitchDeg).toBeUndefined();
    expect(tilted.pitchDeg).toBe(20);
    expect(tilted.pos.z).toBeGreaterThan(flat.pos.z + 200);
  });
});

describe('R03 + R02 friction classifier: feeder -> incline -> collector', () => {
  const cell = (materialIndex: number): EquipmentPlacement[] => [
    { id: 'feed', kind: 'box-feeder', originMm: vec(-300, 0, 0), yawDeg: 0, params: { rateMs: 900, materialId: materialIndex, quantity: 4 } },
    belt(15, { lengthMm: 800 }),
    { id: 'bin', kind: 'collector', originMm: vec(700, 0, 0), yawDeg: 0, params: {} },
  ];
  const go = (materialIndex: number) => {
    const items = cell(materialIndex);
    let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
    for (let i = 0; i < 300; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { feed: { enable: true }, belt: { run: true }, bin: { enable: true } });
    return r;
  };
  it('cartons climb the 15 degree belt into the collector; glass bottles slide back and never arrive', () => {
    const cartons = go(2), bottles = go(3); // 2 = small carton (mu 0.45), 3 = glass bottle (mu 0.25)
    expect(cartons.world.spawnedCount).toBe(4); expect(bottles.world.spawnedCount).toBe(4);
    expect(cartons.signals.bin.count).toBe(4);
    expect(bottles.signals.bin.count).toBe(0);
    expect(conserved(cartons.world) && conserved(bottles.world)).toBe(true);
    expect(materialById('carton-small')?.frictionMu).toBeGreaterThan(Math.tan(15 * Math.PI / 180));
    expect(materialById('bottle-glass')?.frictionMu).toBeLessThan(Math.tan(15 * Math.PI / 180));
    void materialSpawn;
  });
});
