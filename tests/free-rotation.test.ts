import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { bodiesTouch, isComposite, partBoxes, supportTopAt } from '../src/plant/world/geometry';
import { materialById, materialSpawn } from '../src/plant/world/materials';
import type { Body, EquipmentPlacement } from '../src/plant/world/types';

const bar = (x: number, headingDeg?: number, id = 'b'): Body => {
  const b = spawnBody(freshWorld(), 't', { size: vec(300, 40, 40), massKg: 1, pos: vec(x, 0, 0), ...(headingDeg !== undefined ? { headingDeg } : {}) }).bodies[0];
  return { ...b, id };
};
const place = (id: string, kind: string, x: number, params: Record<string, number> = {}): EquipmentPlacement => ({ id, kind, originMm: vec(x, 0, 0), yawDeg: 0, params });

describe('R21/R02 free rotation of a body', () => {
  it('an unrotated body carries no heading and keeps the original single-box path', () => {
    expect(bar(0).headingDeg).toBeUndefined();
    expect(bar(0, 360).headingDeg).toBeUndefined();
    expect(isComposite(bar(0))).toBe(false);
  });
  it('the heading is normalised and a non-finite heading is refused', () => {
    expect(bar(0, -45).headingDeg).toBe(315);
    expect(bar(0, 405).headingDeg).toBe(45);
    expect(() => bar(0, NaN)).toThrow(/heading/);
  });
  it('a bar turned 45 degrees occupies a square footprint, 30 degrees a skewed one', () => {
    const [p45] = partBoxes(bar(0, 45));
    expect(p45.half.x).toBeCloseTo((300 + 40) / 2 / Math.SQRT2, 6); expect(p45.half.y).toBeCloseTo(p45.half.x, 6);
    const [p30] = partBoxes(bar(0, 30));
    expect(p30.half.x).toBeCloseTo((Math.cos(Math.PI / 6) * 300 + Math.sin(Math.PI / 6) * 40) / 2, 6);
    expect(p30.half.y).toBeCloseTo((Math.sin(Math.PI / 6) * 300 + Math.cos(Math.PI / 6) * 40) / 2, 6);
  });
  it('rotating by 90 degrees freely matches the quarter-turn footprint', () => {
    const free = partBoxes(bar(0, 90))[0].half, quarter = partBoxes({ ...bar(0), yawDeg: 90 })[0].half;
    expect(free.x).toBeCloseTo(quarter.x, 6); expect(free.y).toBeCloseTo(quarter.y, 6);
  });
  it('rotation changes what touches: a neighbour 150 mm to the side clears a flat bar but not a diagonal one', () => {
    const neighbour = { ...bar(0, undefined, 'n'), pos: vec(0, 120, 0), size: vec(100, 100, 40) };
    expect(bodiesTouch(bar(0), neighbour)).toBe(false);
    expect(bodiesTouch(bar(0, 45), neighbour)).toBe(true);
  });
  it('composite parts rotate about the body centre', () => {
    const crate = spawnBody(freshWorld(), 't', { ...materialSpawn(materialById('crate-irregular')!, vec(0, 0, 0)), headingDeg: 90 }).bodies[0];
    const tower = partBoxes(crate)[1];
    expect(tower.center.x).toBeCloseTo(0, 6); expect(tower.center.y).toBeCloseTo(110, 6);
    expect(supportTopAt(crate, 0, 110)).not.toBeNull();
    expect(supportTopAt(crate, 0, 110)!).toBeGreaterThan(supportTopAt(crate, 110, 0)!);   // tower is now along y, low base along x
  });
});

describe('R21/R02 rotated bodies in the live scan engine', () => {
  const run = (heading: number) => {
    const items = [place('feed', 'box-feeder', -200, { rateMs: 400, materialId: 12, quantity: 3, headingDeg: heading }), place('belt', 'belt-conveyor', 0, { lengthMm: 1200, speedMmS: 500 }), place('bin', 'collector', 800, {})];
    let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
    const seen = new Set<number>();
    for (let i = 0; i < 160; i++) {
      r = stepScene(r, items, PLANT_EQUIPMENT, { feed: { enable: true }, belt: { run: true } });
      for (const b of r.world.bodies) seen.add(b.headingDeg ?? 0);
    }
    return { world: r.world, seen };
  };
  it('the feeder places bodies at the chosen heading and they keep it down the belt', () => {
    const { seen } = run(35);
    expect([...seen]).toEqual([35]);
  });
  it("rotated bodies flow like unrotated ones and are conserved", () => {
    const base = run(0).world;
    expect(run(35).world.spawnedCount).toBe(base.spawnedCount);
    const { world } = run(35);
    expect(world.spawnedCount).toBeGreaterThanOrEqual(2);
    expect(world.despawnedCount + world.bodies.length).toBe(world.spawnedCount);
    expect(world.despawnedCount).toBe(base.despawnedCount);
  });
});
