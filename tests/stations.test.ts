import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { materialById, materialSpawn } from '../src/plant/world/materials';
import type { EquipmentPlacement, World } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, params: Record<string, number> = {}): EquipmentPlacement => ({ id, kind, originMm: vec(x, 0, 0), yawDeg: 0, params });
const part = (w: World, material: string, x: number, tags: Record<string, string | number | boolean> = {}): World =>
  spawnBody(w, 't', materialSpawn(materialById(material)!, vec(x, 0, 120), { supportedBy: 'belt', tags }));
type Inputs = Record<string, Record<string, boolean | number>>;
const run = (items: EquipmentPlacement[], world: World, inputs: Inputs, scans: number, faults: Record<string, string | null> = {}) => {
  let r = freshRuntime(world, items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, inputs, faults);
  return r;
};
// A station on a belt that is not running: the part simply stands in the station.
const belt = P('belt', 'belt-conveyor', 0, { lengthMm: 1000 });
const station = (op: number, extra: Record<string, number> = {}) => P('st', 'process-station', 0, { operation: op, cycleMs: 1000, ...extra });
const stage = (w: World, i = 0) => w.bodies[i].tags.stage;

describe('R05 machining: raw -> machined over the cycle time', () => {
  it('nothing happens until run is commanded, then the part is machined only after the full cycle', () => {
    const w = part(freshWorld(), 'metal-workpiece', 0);
    expect(stage(run([belt, station(1)], w, {}, 40).world)).toBe('raw');
    const early = run([belt, station(1)], w, { st: { run: true } }, 10);   // 0.5 s of a 1 s cycle
    expect(stage(early.world)).toBe('raw');
    expect(early.world.model.st.engaged).toBe(true);
    expect(early.world.model.st.progress).toBeGreaterThan(0.3); expect(early.world.model.st.progress).toBeLessThan(0.7);
    const done = run([belt, station(1)], w, { st: { run: true } }, 25);
    expect(stage(done.world)).toBe('machined');
    expect(done.world.model.st.count).toBe(1);
  });
  it('a moving part is not machined, and a part already machined is not machined again', () => {
    const moving = run([belt, station(1)], part(freshWorld(), 'metal-workpiece', 0), { st: { run: true }, belt: { run: true } }, 40).world;
    expect(stage(moving)).toBe('raw');
    const w = part(freshWorld(), 'metal-workpiece', 0, { stage: 'machined' });
    expect(run([belt, station(1)], w, { st: { run: true } }, 60).world.model.st.count).toBe(0);
  });
  it('the part carries a trace of where it was made', () => {
    const r = run([belt, station(1)], part(freshWorld(), 'metal-workpiece', 0), { st: { run: true } }, 25);
    expect(r.world.bodies[0].tags.trace).toBe('M:st');
    expect(r.world.bodies[0].tags.machinedBy).toBe('st');
  });
  it('a dead tool or stuck station stops the cycle', () => {
    for (const fault of ['tool-broken', 'station-stuck']) {
      const r = run([belt, station(1)], part(freshWorld(), 'metal-workpiece', 0), { st: { run: true } }, 40, { st: fault });
      expect(stage(r.world), fault).toBe('raw');
    }
  });
});

describe('R18 tool wear and defects (seeded, deterministic)', () => {
  const batch = (extra: Record<string, number>, fault: string | null = null) => {
    let defects = 0, wear = 0;
    // five parts machined one after another at the same place, each removed after its cycle
    let r = freshRuntime(freshWorld(), [belt, station(1, extra)], PLANT_EQUIPMENT);
    for (let k = 0; k < 5; k++) {
      r = { ...r, world: part(r.world, 'metal-workpiece', 0) };
      for (let i = 0; i < 25; i++) r = stepScene(r, [belt, station(1, extra)], PLANT_EQUIPMENT, { st: { run: true } }, { st: fault });
      const made = r.world.bodies[r.world.bodies.length - 1];
      if (made.tags.defect) defects++;
      r = { ...r, world: { ...r.world, bodies: r.world.bodies.slice(0, -1) } };
      wear = r.world.model.st.value;
    }
    return { defects, wear };
  };
  it('a fresh tool with no base defect rate makes no defects; tool wear counts cycles', () => {
    const r = batch({});
    expect(r.defects).toBe(0); expect(r.wear).toBe(5);
  });
  it('a tool past its life makes defective parts; a changed tool does not', () => {
    expect(batch({ toolLifeCycles: 2 }).defects).toBeGreaterThan(0);
    expect(batch({ toolLifeCycles: 100 }).defects).toBe(0);
    expect(batch({}, 'tool-worn').defects).toBeGreaterThan(0);
  });
  it('the defect pattern is reproducible (same seed, same run)', () => {
    expect(batch({ defectPct: 50 })).toEqual(batch({ defectPct: 50 }));
  });
  it('base defect rate 100 percent makes every part defective', () => {
    expect(batch({ defectPct: 100 }).defects).toBe(5);
  });
});

describe('R05 joining and assembly: two parts become one', () => {
  it('assembly consumes the component, adds its mass, and the part becomes assembled', () => {
    let w = part(freshWorld(), 'metal-workpiece', -40, { stage: 'machined' });
    w = part(w, 'lid', 60);
    const r = run([belt, station(3)], w, { st: { run: true } }, 40);
    expect(r.world.bodies).toHaveLength(1);
    expect(r.world.despawnedCount).toBe(1);
    expect(stage(r.world)).toBe('assembled');
    expect(r.world.bodies[0].massKg).toBeCloseTo(3.05, 6);
    expect(r.world.bodies[0].tags.parts).toBe(2);
    expect(r.world.bodies[0].tags.trace).toBe('A:st');
  });
  it('assembly needs both parts: a lone machined part is not assembled, and a raw part is refused', () => {
    expect(stage(run([belt, station(3)], part(freshWorld(), 'metal-workpiece', 0, { stage: 'machined' }), { st: { run: true } }, 40).world)).toBe('machined');
    let w = part(freshWorld(), 'metal-workpiece', -40);   // still raw
    w = part(w, 'lid', 60);
    expect(run([belt, station(3)], w, { st: { run: true } }, 40).world.bodies).toHaveLength(2);
  });
  it('joining welds two machined parts into one', () => {
    let w = part(freshWorld(), 'metal-workpiece', -40, { stage: 'machined' });
    w = part(w, 'metal-workpiece', 60, { stage: 'machined' });
    const r = run([belt, station(2)], w, { st: { run: true } }, 40);
    expect(r.world.bodies).toHaveLength(1);
    expect(r.world.bodies[0].massKg).toBeCloseTo(6, 6);
    expect(stage(r.world)).toBe('assembled');
  });
});

describe('R18 inspection and rejection', () => {
  it('a good part passes and a defective part fails; the fail signal reads true only for the failed part', () => {
    const good = run([belt, station(4)], part(freshWorld(), 'metal-workpiece', 0, { stage: 'machined' }), { st: { run: true } }, 25);
    expect(good.world.bodies[0].tags.inspectResult).toBe('pass');
    expect(good.world.model.st.phase).toBe(0);
    const bad = run([belt, station(4)], part(freshWorld(), 'metal-workpiece', 0, { stage: 'machined', defect: true }), { st: { run: true } }, 25);
    expect(bad.world.bodies[0].tags.inspectResult).toBe('fail');
    expect(bad.world.bodies[0].tags.rejected).toBe(true);
    expect(bad.world.model.st.phase).toBe(1);
    expect(PLANT_EQUIPMENT['process-station'].read(bad.world.model.st, bad.world, { id: 'st', originMm: vec(0, 0, 0), yawDeg: 0, params: { operation: 4 } } as never).fail).toBe(true);
  });
  it('a part is inspected once', () => {
    const r = run([belt, station(4)], part(freshWorld(), 'metal-workpiece', 0, { stage: 'machined' }), { st: { run: true } }, 100);
    expect(r.world.model.st.count).toBe(1);
  });
});

describe('R05/R16/R18 a complete line: machine -> assemble -> inspect with traceability', () => {
  it('a raw part and a lid come out as one assembled, inspected part whose trace names every station', () => {
    const items = [belt, P('m', 'process-station', -300, { operation: 1, cycleMs: 600, lengthMm: 200 }),
      P('a', 'process-station', 0, { operation: 3, cycleMs: 600, lengthMm: 200 }), P('i', 'process-station', 300, { operation: 4, cycleMs: 600, lengthMm: 200 })];
    // Parts are placed at each station in turn, as a stopper-indexed line would deliver them.
    let r = freshRuntime(part(freshWorld(), 'metal-workpiece', -300), items, PLANT_EQUIPMENT);
    const go = (inputs: Inputs, n = 20) => { for (let i = 0; i < n; i++) r = stepScene(r, items, PLANT_EQUIPMENT, inputs); };
    go({ m: { run: true } });
    expect(r.world.bodies[0].tags.stage).toBe('machined');
    r = { ...r, world: { ...r.world, bodies: r.world.bodies.map(b => ({ ...b, pos: vec(0, 0, 120) })) } };
    r = { ...r, world: part(r.world, 'lid', 60) };
    go({ a: { run: true } });
    expect(r.world.bodies).toHaveLength(1);
    expect(r.world.bodies[0].tags.stage).toBe('assembled');
    r = { ...r, world: { ...r.world, bodies: r.world.bodies.map(b => ({ ...b, pos: vec(300, 0, 120) })) } };
    go({ i: { run: true } });
    const done = r.world.bodies[0];
    expect(done.tags.inspectResult).toBe('pass');
    expect(done.tags.trace).toBe('M:m>A:a>I:i');
    expect(r.world.spawnedCount - r.world.despawnedCount).toBe(1);
  });
});
