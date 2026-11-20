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
