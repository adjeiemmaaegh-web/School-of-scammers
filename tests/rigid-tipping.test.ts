import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { centreOfMassHeight, tipOver, tipSpeed } from '../src/plant/world/geometry';
import { materialById, materialSpawn } from '../src/plant/world/materials';
import type { Body, EquipmentPlacement } from '../src/plant/world/types';

const place = (id: string, kind: string, x: number, params: Record<string, number> = {}): EquipmentPlacement =>
  ({ id, kind, originMm: vec(x, 0, 0), yawDeg: 0, params });
const X = { x: 1, y: 0 };
const one = (id: string, x = 0, z = 0): Body => spawnBody(freshWorld(), 't', materialSpawn(materialById(id)!, vec(x, 0, z))).bodies[0];

describe('R01 rigid-body tipping rule', () => {
  it('a tall slender bottle tips at a far lower speed than a squat carton; a pallet never tips at belt speeds', () => {
    const bottle = tipSpeed(one('bottle-pet'), X), carton = tipSpeed(one('carton'), X), pallet = tipSpeed(one('pallet'), X);
    expect(bottle).toBeLessThan(carton);
    expect(carton).toBeLessThan(pallet);
    expect(bottle).toBeLessThan(1000);   // reachable on a fast belt
    expect(pallet).toBeGreaterThan(1000);
  });
  it('the centre of mass of a composite sits where its material is, not at the envelope middle', () => {
    const crate = one('crate-irregular');
    expect(centreOfMassHeight(crate)).not.toBeCloseTo(crate.size.z / 2, 0);
    expect(centreOfMassHeight(one('carton'))).toBeCloseTo(one('carton').size.z / 2, 6);
  });
  it('tipping swaps height and travel-direction extent and conserves volume', () => {
    const b = one('bottle-pet');
    const t = tipOver(b, X);
    expect(t.size.x).toBeCloseTo(b.size.z); expect(t.size.z).toBeCloseTo(b.size.x);
    expect(t.tags.tipped).toBe(true);
    const vol = (body: Body) => (body.parts ?? [{ sx: body.size.x, sy: body.size.y, sz: body.size.z }]).reduce((v, p) => v + p.sx * p.sy * p.sz, 0);
    expect(vol(t)).toBeCloseTo(vol(b), 0);
  });
});

describe('R01 tipping in the live scan engine', () => {
  const crash = (material: string, speed: number) => {
    const items = [place('belt', 'belt-conveyor', 0, { lengthMm: 1000, speedMmS: speed }), place('stop', 'stopper', 450, {})];
    const spec = { ...materialSpawn(materialById(material)!, vec(-250, 0, 120)), supportedBy: 'belt' };
    let r = freshRuntime(spawnBody(freshWorld(), 'test', spec), items, PLANT_EQUIPMENT);
    for (let i = 0; i < 80; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { belt: { run: true }, stop: { extend: true } });
    return r.world.bodies[0];
  };
  it('a bottle driven into a stopper at belt speed falls over; the same bottle at a gentle speed stays upright', () => {
    const fast = crash('bottle-pet', 1000), slow = crash('bottle-pet', 150);
    expect(fast.tags.tipped).toBe(true);
    expect(slow.tags.tipped).toBeUndefined();
  });
  it('a carton at the same speed does not tip', () => {
    expect(crash('carton', 1000).tags.tipped).toBeUndefined();
  });
});

describe('R01 sliding, friction and pushing on the floor', () => {
  const slide = (specs: Array<{ x: number; vx: number; mass: number; mu?: number }>, scans: number) => {
    let w = freshWorld();
    for (const s of specs) w = spawnBody(w, 't', { size: vec(100, 100, 100), massKg: s.mass, pos: vec(s.x, 0, 0), tags: { frictionMu: s.mu ?? 0.4, floorDynamics: true } });
    w = { ...w, bodies: w.bodies.map((b, i) => ({ ...b, vel: vec(specs[i].vx, 0, 0) })) };
    let r = freshRuntime(w, [], PLANT_EQUIPMENT);
    for (let i = 0; i < scans; i++) r = stepScene(r, [], PLANT_EQUIPMENT, {});
    return r.world.bodies;
  };
  it('a sliding body decelerates under Coulomb friction and stops at v^2/(2 mu g)', () => {
    const [b] = slide([{ x: 0, vx: 1000, mass: 2 }], 200);
    expect(b.vel.x).toBe(0);
    const expected = 1000 * 1000 / (2 * 0.4 * 9810);                     // about 127 mm
    expect(b.pos.x).toBeGreaterThan(expected * 0.9); expect(b.pos.x).toBeLessThan(expected * 1.1);
  });
  it('a slippery body slides further than a grippy one', () => {
    expect(slide([{ x: 0, vx: 1000, mass: 2, mu: 0.1 }], 200)[0].pos.x).toBeGreaterThan(slide([{ x: 0, vx: 1000, mass: 2, mu: 0.6 }], 200)[0].pos.x * 3);
  });
  it('a heavy body pushes a light one ahead of it and momentum is shared', () => {
    const [heavy, light] = slide([{ x: 0, vx: 800, mass: 10, mu: 0.05 }, { x: 150, vx: 0, mass: 1, mu: 0.05 }], 6);
    expect(light.pos.x).toBeGreaterThan(150);                         // pushed forward
    expect(heavy.pos.x).toBeLessThan(light.pos.x);                    // never passes through
    expect(Math.abs(heavy.vel.x - light.vel.x)).toBeLessThan(15);   // inelastic: shared velocity (one substep of friction apart)
    expect(heavy.vel.x).toBeGreaterThan(500); // about 10/11 of 800 less friction
  });
  it('a light body hitting a heavy one barely moves it', () => {
    const [light, heavy] = slide([{ x: 0, vx: 800, mass: 1, mu: 0.05 }, { x: 150, vx: 0, mass: 50, mu: 0.05 }], 6);
    expect(heavy.vel.x).toBeLessThan(40);
    expect(light.pos.x).toBeLessThan(heavy.pos.x);
  });
});

describe('R01 compatibility: bodies without floorDynamics coast exactly as before', () => {
  it('a legacy sliding body is not slowed', () => {
    let w = spawnBody(freshWorld(), 't', { size: vec(100, 100, 100), massKg: 2, pos: vec(0, 0, 0), tags: { frictionMu: 0.4 } });
    w = { ...w, bodies: w.bodies.map(b => ({ ...b, vel: vec(500, 0, 0) })) };
    let r = freshRuntime(w, [], PLANT_EQUIPMENT);
    for (let i = 0; i < 20; i++) r = stepScene(r, [], PLANT_EQUIPMENT, {});
    expect(r.world.bodies[0].vel.x).toBe(500);
  });
});
