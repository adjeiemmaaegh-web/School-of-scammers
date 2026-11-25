import { describe, expect, it } from 'vitest';
import { conserved, freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { bodiesTouch, isComposite, partBoxes, supportTopAt, sweptContact, volumeOverlap } from '../src/plant/world/geometry';
import { materialById, materialSpawn, MATERIALS } from '../src/plant/world/materials';
import type { Body, EquipmentPlacement, World } from '../src/plant/world/types';
import type { SpawnSpec } from '../src/plant/world/bodies';

const spawnOf = (id: string, x: number, y: number, z = 0, extra: Partial<SpawnSpec> = {}): SpawnSpec => ({ ...materialSpawn(materialById(id)!, vec(x, y, z)), ...extra });
const one = (spec: SpawnSpec): Body => spawnBody(freshWorld(), 't', spec).bodies[0];
const cube = (x: number, y: number, z: number): SpawnSpec => ({ size: vec(60, 60, 60), massKg: 1, pos: vec(x, y, z), tags: { material: 'test' } });
const settle = (w: World, scans = 30) => {
  let r = freshRuntime(w, [], PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, [], PLANT_EQUIPMENT, {});
  return r.world;
};

describe('R02 composite bodies are real shapes', () => {
  it('the catalogue contains composites with genuinely different geometry (not one box with another name)', () => {
    const composites = MATERIALS.filter(m => m.parts);
    expect(composites.map(m => m.id).sort()).toEqual(['bottle-glass', 'bottle-pet', 'bracket-l', 'crate-irregular', 'pallet', 'raw-material']);
    for (const m of composites) {
      expect(m.parts!.length, m.id).toBeGreaterThanOrEqual(2);
      // the parts really are smaller than their envelope: material is missing somewhere
      const volume = m.parts!.reduce((v, p) => v + p.sx * p.sy * p.sz, 0), envelope = m.sizeMm.x * m.sizeMm.y * m.sizeMm.z;
      expect(volume, m.id).toBeLessThan(envelope * 0.97);
      // and every part lies inside the envelope
      for (const p of m.parts!) { expect(Math.abs(p.dx) + p.sx / 2).toBeLessThanOrEqual(m.sizeMm.x / 2 + 1e-6); expect(Math.abs(p.dy) + p.sy / 2).toBeLessThanOrEqual(m.sizeMm.y / 2 + 1e-6); expect(p.z + p.sz).toBeLessThanOrEqual(m.sizeMm.z + 1e-6); }
    }
  });
  it('plain bodies are untouched: one box, no parts', () => {
    const b = one(cube(0, 0, 0));
    expect(isComposite(b)).toBe(false);
    expect(partBoxes(b)).toHaveLength(1);
  });
  it('parts follow the body orientation: a quarter turn swaps the footprint and rotates the offsets', () => {
    const crate = one(spawnOf('crate-irregular', 0, 0));
    const tower0 = partBoxes(crate)[1];
    expect(tower0.center.x).toBeCloseTo(110); expect(tower0.center.y).toBeCloseTo(0);
    const turned = one(spawnOf('crate-irregular', 0, 0, 0, { yawDeg: 90 }));
    const tower90 = partBoxes(turned)[1];
    expect(tower90.center.x).toBeCloseTo(0); expect(tower90.center.y).toBeCloseTo(110);
    expect(tower90.half.x).toBeCloseTo(130); expect(tower90.half.y).toBeCloseTo(100);
  });
  it('invalid composite parts are refused at spawn', () => {
    const bad = (parts: unknown) => () => spawnBody(freshWorld(), 't', { ...cube(0, 0, 0), parts: parts as never });
    expect(bad([])).toThrow(/composite/);
    expect(bad([{ dx: 0, dy: 0, z: 0, sx: 0, sy: 10, sz: 10 }])).toThrow(/composite/);
    expect(bad(Array.from({ length: 9 }, () => ({ dx: 0, dy: 0, z: 0, sx: 10, sy: 10, sz: 10 })))).toThrow(/composite/);
    expect(bad([{ dx: NaN, dy: 0, z: 0, sx: 10, sy: 10, sz: 10 }])).toThrow(/composite/);
  });
});

describe('R02/R01 composite contact: shape decides what touches', () => {
  it('a cube beside the tower of a stepped crate, but above its low base, does not touch; at the tower it does', () => {
    const crate = one(spawnOf('crate-irregular', 0, 0));                         // base 0..100 high, tower x -.. +10..210 up to 180
    const aboveBase = { ...one(cube(-100, 0, 100)), id: 'c1' };                    // sits on the base, away from the tower
    const atTower = { ...one(cube(110, 0, 100)), id: 'c2' };                       // inside the tower's column
    expect(bodiesTouch(aboveBase, crate)).toBe(false);
    expect(bodiesTouch(atTower, crate)).toBe(true);
    // the old single-envelope rule would have said TOUCH for both
    const legacy = { ...crate, parts: undefined };
    expect(bodiesTouch(aboveBase, legacy)).toBe(true);
  });
  it('volume overlap and swept contact are part by part: a cube slides along the base top until it meets the tower face', () => {
    const crate = one(spawnOf('crate-irregular', 0, 0));
    const slider = { ...one(cube(-150, 0, 100)), id: 's' };
    expect(volumeOverlap(slider, crate)).toBe(false);
    const t = sweptContact(slider, crate, vec(300, 0, 0));
    expect(t).not.toBeNull();
    // the tower face is at x = 110 - 100 = 10; the cube's front reaches it after moving 10 - 30 - (-150) = 130 mm of 300
    expect(t! * 300).toBeCloseTo(130, 0);
    // a cube a little LOWER (inside the base height) hits the base side at x = -210 + ... much earlier
    const low = { ...one(cube(-300, 0, 0)), id: 'l' };
    expect(sweptContact(low, crate, vec(300, 0, 0))! * 300).toBeCloseTo(60, 0);
  });
  it('a pallet is open underneath: a low body fits between its stringers, a tall one cannot', () => {
    const pallet = one(spawnOf('pallet', 0, 0));
    const gapLow = { ...one({ ...cube(0, -175, 0), size: vec(60, 60, 60) }), id: 'g' };         // in the gap between stringers, below the deck
    const gapTall = { ...one({ ...cube(0, -175, 0), size: vec(60, 60, 140) }), id: 'h' };       // pokes into the deck
    expect(bodiesTouch(gapLow, pallet)).toBe(false);
    expect(bodiesTouch(gapTall, pallet)).toBe(true);
    const onStringer = { ...one(cube(0, -350, 0)), id: 'st' };
    expect(bodiesTouch(onStringer, pallet)).toBe(true);
  });
});

describe('R01/R02 stacking rests on the real surface under the load', () => {
  it('a cube dropped on a stepped crate rests on the BASE where there is only a base and on the TOWER where there is a tower', () => {
    const rest = (x: number) => {
      const w = settle(spawnBody(spawnBody(freshWorld(), 't', spawnOf('crate-irregular', 0, 0)), 't', cube(x, 0, x > 0 ? 184 : 104)), 12);
      return w.bodies[1];
    };
    const onBase = rest(-100), onTower = rest(110);
    expect(onBase.pos.z).toBeCloseTo(100, 0); expect(onBase.supportedBy).toBe('b1');
    expect(onTower.pos.z).toBeCloseTo(180, 0); expect(onTower.supportedBy).toBe('b1');
  });
  it('a cube dropped on a pallet rests on its deck, and one over the empty notch of an L-bracket falls to the floor', () => {
    const onDeck = settle(spawnBody(spawnBody(freshWorld(), 't', spawnOf('pallet', 0, 0)), 't', cube(100, 100, 152)), 12).bodies[1];
    expect(onDeck.pos.z).toBeCloseTo(150, 0); expect(onDeck.supportedBy).toBe('b1');
    // L-bracket: base 120 long, upright only at the -x end; a cube hovering over the empty +x end of the base rests on the 20 mm base
    const bracket = settle(spawnBody(spawnBody(freshWorld(), 't', spawnOf('bracket-l', 0, 0)), 't', cube(30, 0, 22)), 12).bodies[1];
    expect(bracket.pos.z).toBeCloseTo(20, 0);
    // beside the bracket, no material: it falls to the floor
    const beside = settle(spawnBody(spawnBody(freshWorld(), 't', spawnOf('bracket-l', 0, 0)), 't', cube(400, 0, 22)), 20).bodies[1];
    expect(beside.pos.z).toBe(0);
  });
  it('support is conserved bookkeeping: bodies are never created or lost by stacking', () => {
    const w = settle(spawnBody(spawnBody(freshWorld(), 't', spawnOf('crate-irregular', 0, 0)), 't', cube(110, 0, 184)), 20);
    expect(conserved(w)).toBe(true); expect(w.bodies).toHaveLength(2);
    expect(supportTopAt(w.bodies[0], 110, 0)).toBe(180); expect(supportTopAt(w.bodies[0], -100, 0)).toBe(100); expect(supportTopAt(w.bodies[0], 500, 0)).toBeNull();
  });
});

describe('R02/R04 sensors see the real shape', () => {
  const laser = (p: Record<string, number>): EquipmentPlacement => ({ id: 's', kind: 'laser-distance', originMm: vec(-1500, 0, 0), yawDeg: 0, params: { rangeMm: 1500, ...p } });
  const reading = (item: EquipmentPlacement, w: World) => {
    let r = freshRuntime(w, [item], PLANT_EQUIPMENT);
    for (let i = 0; i < 2; i++) r = stepScene(r, [item], PLANT_EQUIPMENT, {});
    return r.signals.s;
  };
  const palletWorld = (): World => spawnBody(freshWorld(), 't', spawnOf('pallet', 0, 0));
  it('a laser aimed through the gap between stringers sees nothing; aimed at a stringer or at the deck it sees the pallet', () => {
    // pallet 1200 long: its near face is at x = -600, i.e. 900 mm from a sensor at x = -1500
    const throughGap = reading({ ...laser({ beamHeightMm: 40 }), originMm: vec(-1500, -175, 0) }, palletWorld());
    expect(throughGap.present).toBe(false);
    const atStringer = reading({ ...laser({ beamHeightMm: 40 }), originMm: vec(-1500, 0, 0) }, palletWorld());
    expect(atStringer.present).toBe(true); expect(atStringer.distanceMm).toBe(900);
    const atDeck = reading({ ...laser({ beamHeightMm: 130 }), originMm: vec(-1500, -175, 0) }, palletWorld());
    expect(atDeck.present).toBe(true); expect(atDeck.distanceMm).toBe(900);
  });
  it('a laser sees a bottle neck as a thinner target than its body (distance changes with the height it is aimed at)', () => {
    const w = spawnBody(freshWorld(), 't', spawnOf('bottle-glass', 0, 0));
    const sensor = (z: number): EquipmentPlacement => ({ ...laser({ beamHeightMm: z }), originMm: vec(-500, 0, 0), params: { rangeMm: 600, beamHeightMm: z } });
    expect(reading(sensor(100), w).distanceMm).toBe(465);   // body radius 35: surface at 500 - 35
    expect(reading(sensor(220), w).distanceMm).toBe(486);   // neck radius 14: surface at 500 - 14
  });
  it('a laser over the low arm of an L-bracket sees the upright only at the height of the upright', () => {
    const w = spawnBody(freshWorld(), 't', spawnOf('bracket-l', 0, 0));
    // sensor on the open +x side looking back along -x: the base ends at x = +60, the upright stands at x = -60..-40
    const at = (z: number) => reading({ ...laser({}), originMm: vec(500, 0, 0), params: { rangeMm: 700, beamHeightMm: z, aimDeg: 180 } }, w);
    expect(at(10).distanceMm).toBe(440);   // low beam meets the end of the base at x = +60
    expect(at(50).distanceMm).toBe(540);   // beam above the base passes over it and meets the upright face at x = -40
    expect(at(90).present).toBe(false);    // above the whole bracket
  });
});

describe('R02/R26 composite bodies flow through a real line and are conserved', () => {
  const line = (materialId: number, quantity: number): EquipmentPlacement[] => [
    { id: 'feed', kind: 'box-feeder', originMm: vec(-900, 0, 0), yawDeg: 0, params: { rateMs: 3000, materialId, quantity } },
    { id: 'belt', kind: 'belt-conveyor', originMm: vec(0, 0, 0), yawDeg: 0, params: { lengthMm: 2400, widthMm: 600, speedMmS: 500 } },
    { id: 'bin', kind: 'collector', originMm: vec(1800, 0, 0), yawDeg: 0, params: { capacity: 10 } },
  ];
  const run = (items: EquipmentPlacement[], scans: number) => {
    let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
    for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { feed: { enable: true }, belt: { run: true }, bin: { enable: true } });
    return r;
  };
  it('pallets (index 5) travel as whole composite bodies and every one is collected', () => {
    const r = run(line(5, 2), 460);
    expect(r.world.spawnedCount).toBe(2);
    expect(r.signals.bin.count).toBe(2);
    expect(r.world.bodies).toHaveLength(0);
    expect(conserved(r.world)).toBe(true);
    expect(r.signals.bin.weightKg).toBeCloseTo(50, 1);
  });
  it('L-brackets (index 13) keep their composite shape in flight and are collected', () => {
    const items = line(13, 3);
    let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT), sawComposite = false;
    for (let i = 0; i < 400; i++) {
      r = stepScene(r, items, PLANT_EQUIPMENT, { feed: { enable: true }, belt: { run: true }, bin: { enable: true } });
      if (r.world.bodies.some(b => b.parts && b.parts.length === 2)) sawComposite = true;
    }
    expect(sawComposite).toBe(true);
    expect(r.signals.bin.count).toBe(3);
    expect(conserved(r.world)).toBe(true);
  });
});
