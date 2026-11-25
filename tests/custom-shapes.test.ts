import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { bodiesTouch, partBoxes, supportTopAt } from '../src/plant/world/geometry';
import { materialSpawn } from '../src/plant/world/materials';
import { composeShape, shapeErrors } from '../src/plant/world/custom-shapes';
import type { CustomShapeDef } from '../src/plant/world/custom-shapes';
import type { EquipmentPlacement } from '../src/plant/world/types';

// A learner's T-shaped bracket: a 200x60 bar with a 60x120 stem below its middle.
const tee: CustomShapeDef = { id: 'tee-bracket', label: 'T bracket', massKg: 2, frictionMu: 0.35, blocks: [
  { x: 0, y: 0, z: 0, w: 200, d: 60, h: 40 }, { x: 70, y: 60, z: 0, w: 60, d: 120, h: 40 }] };

describe('R02 learner-authored composite shapes', () => {
  it('a valid definition becomes a composite material re-centred on its envelope', () => {
    const m = composeShape(tee);
    expect(m.sizeMm).toEqual(vec(200, 180, 40));
    expect(m.parts).toHaveLength(2);
    expect(m.parts![0].dy).toBeCloseTo(30 - 90); expect(m.parts![1].dy).toBeCloseTo(120 - 90);
    for (const p of m.parts!) { expect(Math.abs(p.dx) + p.sx / 2).toBeLessThanOrEqual(100 + 1e-9); expect(Math.abs(p.dy) + p.sy / 2).toBeLessThanOrEqual(90 + 1e-9); }
  });
  it('a one-block shape is a plain body (no parts)', () => {
    expect(composeShape({ id: 'slab', label: 'Slab', massKg: 1, blocks: [{ x: 5, y: 5, z: 5, w: 100, d: 50, h: 20 }] }).parts).toBeUndefined();
  });
  it('the authored shape is a real shape: the notch beside the stem does not touch, the stem does', () => {
    const body = (x: number, y: number) => ({ ...spawnBody(freshWorld(), 't', { size: vec(40, 40, 40), massKg: 1, pos: vec(x, y, 0) }).bodies[0], id: 'probe' });
    const t = spawnBody(freshWorld(), 't', materialSpawn(composeShape(tee), vec(0, 0, 0))).bodies[0];
    expect(bodiesTouch(t, body(-80, 60))).toBe(false);   // in the notch left of the stem
    expect(bodiesTouch(t, body(0, 60))).toBe(true);      // on the stem
    expect(supportTopAt(t, -80, 60)).toBeNull();
  });
  it('rejects every kind of bad definition with a reason', () => {
    const bad = (over: Partial<CustomShapeDef>) => shapeErrors({ ...tee, ...over }).join('|');
    expect(bad({ id: 'Bad Id' })).toMatch(/id must be/);
    expect(bad({ id: 'carton' })).toMatch(/already a catalogue/);
    expect(bad({ blocks: [] })).toMatch(/1-8 blocks/);
    expect(bad({ blocks: Array.from({ length: 9 }, () => tee.blocks[0]) })).toMatch(/1-8 blocks/);
    expect(bad({ blocks: [{ ...tee.blocks[0], w: 0 }] })).toMatch(/block 1/);
    expect(bad({ blocks: [{ ...tee.blocks[0], h: NaN }] })).toMatch(/block 1/);
    expect(bad({ blocks: [tee.blocks[0], { x: 900, y: 0, z: 0, w: 50, d: 50, h: 50 }] })).toMatch(/touch or overlap/);
    expect(bad({ massKg: 0 })).toMatch(/mass/);
    expect(bad({ frictionMu: 2 })).toMatch(/friction/);
    expect(bad({})).toBe('');
    expect(() => composeShape({ ...tee, massKg: -1 })).toThrow(/Invalid custom shape/);
  });
  it('an authored shape, rotated, runs the real belt to the collector and is conserved', () => {
    const material = composeShape(tee);
    const items: EquipmentPlacement[] = [
      { id: 'belt', kind: 'belt-conveyor', originMm: vec(0, 0, 0), yawDeg: 0, params: { lengthMm: 1200, speedMmS: 500 } },
      { id: 'bin', kind: 'collector', originMm: vec(800, 0, 0), yawDeg: 0, params: {} }];
    let w = freshWorld();
    w = spawnBody(w, 't', { ...materialSpawn(material, vec(-300, 0, 120), { supportedBy: 'belt', headingDeg: 40 }) });
    let r = freshRuntime(w, items, PLANT_EQUIPMENT);
    for (let i = 0; i < 120; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { belt: { run: true }, bin: { enable: true } });
    expect(r.world.spawnedCount).toBe(1);
    expect(r.world.despawnedCount).toBe(1);
    expect(partBoxes(spawnBody(freshWorld(), 't', materialSpawn(material, vec(0, 0, 0), { headingDeg: 40 })).bodies[0])).toHaveLength(2);
  });
});
