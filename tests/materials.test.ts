import { describe, expect, it } from 'vitest';
import { conserved, freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { MATERIALS, MATERIAL_IDS, materialById, materialByIndex, materialSpawn, materialTags } from '../src/plant/world/materials';
import type { EquipmentPlacement, World } from '../src/plant/world/types';

const place = (id: string, kind: string, x: number, y = 0, params: Record<string, number> = {}): EquipmentPlacement =>
  ({ id, kind, originMm: vec(x, y, 0), yawDeg: 0, params });
const run = (items: EquipmentPlacement[], world: World, inputs: Record<string, Record<string, boolean | number>>, scans: number) => {
  let r = freshRuntime(world, items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, inputs);
  return r;
};

describe('R02/R16 material catalogue', () => {
  it('is a stable, valid catalogue covering every required material class', () => {
    expect(MATERIAL_IDS).toEqual(['carton', 'carton-small', 'bottle-glass', 'bottle-pet', 'pallet', 'metal-workpiece', 'plastic-part', 'lid', 'base', 'raw-material', 'assembled-product', 'crate-irregular']);
    expect(new Set(MATERIAL_IDS).size).toBe(MATERIALS.length);
    const categories = new Set(MATERIALS.map(x => x.category));
    for (const c of ['package', 'container', 'pallet', 'workpiece', 'component', 'raw', 'product']) expect(categories.has(c as never), c).toBe(true);
    for (const x of MATERIALS) {
      expect(x.massKg, x.id).toBeGreaterThan(0); expect(x.frictionMu, x.id).toBeGreaterThan(0.05); expect(x.frictionMu, x.id).toBeLessThan(1);
      // every material must be spawnable as-is through the real validator
      expect(() => spawnBody(freshWorld(), 'test', materialSpawn(x, vec(0, 0, 0))), x.id).not.toThrow();
    }
    expect(MATERIALS.some(x => x.sizeMm.x < 100) && MATERIALS.some(x => x.sizeMm.x >= 1200)).toBe(true); // from lids to pallets
    expect(materialById('carton')?.label).toMatch(/Carton/);
    expect(materialByIndex(0)).toBeUndefined(); expect(materialByIndex(13)).toBeUndefined(); expect(materialByIndex(3)?.id).toBe('bottle-glass');
  });
  it('contributes the sensor tags the existing sensors read, plus friction, category and stage', () => {
    expect(materialTags(materialById('metal-workpiece')!)).toMatchObject({ material: 'metal-workpiece', metal: true, reflective: true, category: 'workpiece', stage: 'raw', frictionMu: 0.3 });
    expect(materialTags(materialById('bottle-glass')!)).toMatchObject({ transparent: true, bottle: true, capped: false, filledMl: 0 });
    expect(materialTags(materialById('carton')!).metal).toBeUndefined();
    expect(materialTags(materialById('carton')!).transparent).toBeUndefined();
  });
  it('mixed sizes and weights are allowed through overrides and survive validation', () => {
    const big = materialSpawn(materialById('carton')!, vec(0, 0, 0), { size: vec(400, 300, 300), massKg: 14 });
    expect(big.massKg).toBe(14); expect(big.size.x).toBe(400);
    expect(() => spawnBody(freshWorld(), 'x', materialSpawn(materialById('carton')!, vec(0, 0, 0), { massKg: 0 }))).toThrow(/Invalid plant body/);
  });
});

describe('materials drive real sensors', () => {
  const at = (id: string) => materialSpawn(materialById(id)!, vec(0, 0, 100));
  const seen = (kind: string, params: Record<string, number>, materialId: string) => {
    const items = [place('s', kind, 0, 0, params)];
    const r = run(items, spawnBody(freshWorld(), 'test', at(materialId)), {}, 8);
    return r.signals.s.present === true;
  };
  it('the inductive sensor detects conductive materials only', () => {
    expect(seen('inductive-prox', { responseMs: 0 }, 'metal-workpiece')).toBe(true);
    for (const id of ['carton', 'plastic-part', 'bottle-glass', 'pallet']) expect(seen('inductive-prox', { responseMs: 0 }, id), id).toBe(false);
  });
  it('the geometry photoeye in glass-ignoring mode sees opaque materials but not transparent bottles', () => {
    expect(seen('geometry-photoeye', { responseMs: 0, materialMode: 1 }, 'carton')).toBe(true);
    expect(seen('geometry-photoeye', { responseMs: 0, materialMode: 1 }, 'bottle-glass')).toBe(false);
    expect(seen('geometry-photoeye', { responseMs: 0, materialMode: 1 }, 'bottle-pet')).toBe(false);
    expect(seen('geometry-photoeye', { responseMs: 0 }, 'bottle-glass')).toBe(true); // legacy mode still sees it
  });
  it('the weigh cell sums a mixed load', () => {
    let w = freshWorld();
    for (const id of ['carton-small', 'plastic-part', 'metal-workpiece']) w = spawnBody(w, 't', materialSpawn(materialById(id)!, vec(0, 0, 40)));
    const r = run([place('cell', 'weigh-cell', 0, 0, { noiseGram: 0 })], w, {}, 4);
    expect(r.signals.cell.weightKg).toBeCloseTo(2 + 0.2 + 3, 2);
  });
});

describe('friction limits how fast a belt accelerates a load', () => {
  it('a slippery glass bottle lags a carton, and a legacy body behaves exactly as before', () => {
    const belt = place('belt', 'belt-conveyor', 0, 0, { lengthMm: 1000, speedMmS: 500 });
    const travel = (tags: Record<string, string | number | boolean>) => {
      const w = spawnBody(freshWorld(), 'test', { size: vec(100, 100, 80), massKg: 2, pos: vec(100, 0, 120), supportedBy: 'belt', tags });
      return run([belt], w, { belt: { run: true } }, 4).world.bodies[0].pos.x - 100;
    };
    const carton = travel({ material: 'carton', frictionMu: 0.45 });
    const bottle = travel({ material: 'bottle-glass', frictionMu: 0.25 });
    const legacy = travel({ material: 'cardboard' });
    expect(bottle).toBeLessThan(carton);
    expect(carton).toBeGreaterThan(0);
    // legacy default acceleration is 3500 mm/s2 (about mu = 0.357): between the two catalogue materials
    expect(legacy).toBeLessThan(carton); expect(legacy).toBeGreaterThan(bottle);
  });
});

describe('R26 feeder: material choice, production quantity, depletion and variation', () => {
  const feeder = (params: Record<string, number>) => place('feed', 'box-feeder', 0, 0, { rateMs: 200, ...params });
  /** A belt that carries each body away from the exit (a feeder waits while its exit is occupied). */
  const carry = place('away', 'belt-conveyor', 600, 0, { lengthMm: 1600, speedMmS: 800 });
  it('spawns the chosen catalogue material with its shape and sensor tags', () => {
    const r = run([feeder({ materialId: 3 }), carry], freshWorld(), { feed: { enable: true }, away: { run: true } }, 10);
    const b = r.world.bodies[0];
    expect(b.shape).toBe('cylinder'); expect(b.tags).toMatchObject({ material: 'bottle-glass', transparent: true, origin: 'feed' });
  });
  it('the original behaviour is untouched when no material is chosen', () => {
    const r = run([feeder({}), carry], freshWorld(), { feed: { enable: true }, away: { run: true } }, 10);
    expect(['metal', 'cardboard']).toContain(r.world.bodies[0].tags.material);
    expect(r.world.bodies[0].tags.frictionMu).toBeUndefined();
  });
  it('a production run stops at its quantity, reports empty and conserves bodies', () => {
    const r = run([feeder({ materialId: 2, quantity: 4 }), carry], freshWorld(), { feed: { enable: true }, away: { run: true } }, 120);
    expect(r.world.spawnedCount).toBe(4); expect(r.world.bodies).toHaveLength(4);
    expect(r.signals.feed.empty).toBe(true); expect(r.signals.feed.ready).toBe(false); expect(r.signals.feed.count).toBe(4);
    expect(conserved(r.world)).toBe(true);
    // A depleted source also ignores a manual feed pulse (rising edge on CMD_feed).
    const items = [feeder({ materialId: 2, quantity: 4 }), carry];
    let again = r;
    again = stepScene(again, items, PLANT_EQUIPMENT, { feed: { enable: false, feed: false } });
    again = stepScene(again, items, PLANT_EQUIPMENT, { feed: { enable: false, feed: true } });
    expect(again.world.spawnedCount).toBe(4);
    const unlimited = run([feeder({ materialId: 2 }), carry], freshWorld(), { feed: { enable: true }, away: { run: true } }, 120);
    expect(unlimited.world.spawnedCount).toBeGreaterThan(4); expect(unlimited.signals.feed.empty).toBe(false);
  });
  it('seeded variation makes mixed-size, mixed-weight loads deterministically', () => {
    const go = () => run([feeder({ materialId: 1, variationPct: 40, quantity: 6 }), carry], freshWorld(), { feed: { enable: true }, away: { run: true } }, 160).world.bodies;
    const a = go(), b = go();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(new Set(a.map(x => x.massKg)).size).toBeGreaterThan(2);
    expect(new Set(a.map(x => x.size.x)).size).toBeGreaterThan(2);
    for (const x of a) { expect(x.size.x).toBeGreaterThanOrEqual(300 * 0.6 - 1); expect(x.size.x).toBeLessThanOrEqual(300 * 1.4 + 1); }
  });
});

describe('R26 collector: counting, filtering, capacity and a complete production flow', () => {
  const drop = (id: string, x: number) => materialSpawn(materialById(id)!, vec(x, 0, 0));
  const bin = (params: Record<string, number> = {}) => place('bin', 'collector', 0, 0, params);
  it('removes arriving bodies, counts them, tallies weight and logs what was collected', () => {
    let w = freshWorld();
    w = spawnBody(w, 't', drop('carton-small', 50)); w = spawnBody(w, 't', drop('plastic-part', -60));
    const r = run([bin()], w, { bin: { enable: true } }, 3);
    expect(r.world.bodies).toHaveLength(0);
    expect(r.signals.bin.count).toBe(2); expect(r.signals.bin.weightKg).toBeCloseTo(2.2, 2);
    expect(r.world.despawnedCount).toBe(2); expect(conserved(r.world)).toBe(true);
    const text = r.world.events.map(e => e.detail).join('|');
    expect(text).toMatch(/Collected carton-small/); expect(text).toMatch(/Collected plastic-part/);
  });
  it('is closed without its enable input and refuses bodies when jammed', () => {
    const w = spawnBody(freshWorld(), 't', drop('carton', 0));
    expect(run([bin()], w, { bin: { enable: false } }, 3).world.bodies).toHaveLength(1);
    let r = freshRuntime(w, [bin()], PLANT_EQUIPMENT);
    for (let i = 0; i < 3; i++) r = stepScene(r, [bin()], PLANT_EQUIPMENT, { bin: { enable: true } }, { bin: 'collector-jammed' });
    expect(r.world.bodies).toHaveLength(1);
  });
  it('stops at capacity and reports full; only the accepted material is taken when filtering', () => {
    let w = freshWorld();
    for (let i = 0; i < 5; i++) w = spawnBody(w, 't', drop('carton-small', (i - 2) * 40));
    const r = run([bin({ capacity: 3 })], w, { bin: { enable: true } }, 4);
    expect(r.signals.bin.count).toBe(3); expect(r.signals.bin.full).toBe(true); expect(r.world.bodies).toHaveLength(2);
    let mixed = freshWorld();
    mixed = spawnBody(mixed, 't', drop('carton-small', 0)); mixed = spawnBody(mixed, 't', drop('lid', 40));
    const filtered = run([bin({ acceptMaterial: 8 })], mixed, { bin: { enable: true } }, 3); // 8 = lid
    expect(filtered.world.bodies.map(b => b.tags.material)).toEqual(['carton-small']);
    expect(filtered.signals.bin.count).toBe(1);
  });
  it('a full production run flows source -> belt -> collector with every body accounted for', () => {
    const items = [place('feed', 'box-feeder', 100, 0, { rateMs: 700, materialId: 2, quantity: 6 }),
      place('belt', 'belt-conveyor', 0, 0, { lengthMm: 800, speedMmS: 500 }), place('bin', 'collector', 1050, 0, {})];
    const r = run(items, freshWorld(), { feed: { enable: true }, belt: { run: true }, bin: { enable: true } }, 260);
    expect(r.world.spawnedCount).toBe(6);
    expect(r.signals.bin.count).toBe(6);
    expect(r.world.bodies).toHaveLength(0);
    expect(conserved(r.world)).toBe(true);
    expect(r.signals.feed.empty).toBe(true);
    expect(r.signals.bin.weightKg).toBeCloseTo(12, 1);
  });
});

describe('R26 end to end through the real engine: PLC-run production cell from an empty project', () => {
  // Plant coordinates are (x - 455) x 10 mm: the feeder sits at +100 mm, the 800 mm belt is centred on 0 and the bin at +1050 mm.
  it('Start -> PLC -> feeder and belt; the collector counts the finished run; a miswire shows the consequence', async () => {
    const { createWorld, renderSnapshot, tick } = await import('../src/sim/orchestrator');
    type Cmd = import('../src/sim/signals').Command;
    const build = (collectorEnableFrom: string): import('../src/sim/signals').WorldState => {
      const cmds: Cmd[] = [
        { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } }, { k: 'place', id: 'plc', kind: 'plc', at: { x: 90, y: 10 } },
        { k: 'place', id: 'go', kind: 'start', at: { x: 170, y: 10 } }, { k: 'place', id: 'feed', kind: 'box-feeder', at: { x: 465, y: 225 } },
        { k: 'place', id: 'belt', kind: 'belt-conveyor', at: { x: 455, y: 225 } }, { k: 'place', id: 'bin', kind: 'collector', at: { x: 560, y: 225 } },
        { k: 'wire', id: 'w1', from: 'ps.P24', to: 'plc.L+' }, { k: 'wire', id: 'w2', from: 'ps.M0', to: 'plc.M' },
        { k: 'wire', id: 'w3', from: 'ps.P24', to: 'go.A' }, { k: 'wire', id: 'w4', from: 'go.B', to: 'plc.I0.0' },
        { k: 'wire', id: 'w5', from: 'plc.Q0.0', to: 'feed.CMD_enable+' }, { k: 'wire', id: 'w6', from: 'feed.M-', to: 'ps.M0' },
        { k: 'wire', id: 'w7', from: 'plc.Q0.0', to: 'belt.CMD_run+' }, { k: 'wire', id: 'w8', from: 'belt.M-', to: 'ps.M0' },
        { k: 'wire', id: 'w9', from: collectorEnableFrom, to: 'bin.CMD_enable+' }, { k: 'wire', id: 'w10', from: 'bin.M-', to: 'ps.M0' },
        { k: 'wire', id: 'w11', from: 'ps.P24', to: 'bin.L+' }, { k: 'wire', id: 'w12', from: 'ps.M0', to: 'bin.M' },
        { k: 'setParam', id: 'feed', key: 'quantity', value: 3 }, { k: 'setParam', id: 'feed', key: 'materialId', value: 2 },
        { k: 'setParam', id: 'feed', key: 'rateMs', value: 700 },
        { k: 'setParam', id: 'belt', key: 'lengthMm', value: 800 }, { k: 'setParam', id: 'belt', key: 'speedMmS', value: 500 },
      ];
      return tick(createWorld(), cmds).world;
    };
    const runCell = (w: import('../src/sim/signals').WorldState) => {
      const program = { id: 'cell', version: '1.0', symbols: {}, rungs: [{ id: 'r', elements: [{ type: 'contact' as const, tag: 'Start' }], coil: 'Run' }] };
      w = tick(w, [{ k: 'loadProgram', program }, { k: 'run' }, { k: 'operate', id: 'go', pressed: true }]).world;
      for (let i = 0; i < 320; i++) w = tick(w).world;
      return w;
    };
    const good = build('ps.P24');
    expect(good.lastError).toBeNull();
    const done = runCell(good);
    expect(done.plantWorld.world.spawnedCount).toBe(3);
    expect(done.plantWorld.signals.bin.count).toBe(3);
    expect(done.plantWorld.world.bodies).toHaveLength(0);
    expect(done.plantWorld.signals.feed.empty).toBe(true);
    expect(renderSnapshot(done).tick).toBeGreaterThan(300);
    // Miswire: the collector's enable is wired to the supply COMMON, not 24 V. Product piles up instead of being collected.
    const bad = runCell(build('ps.M0'));
    expect(bad.plantWorld.signals.bin.count).toBe(0);
    expect(bad.plantWorld.world.spawnedCount).toBe(3);
  });
});

describe('R14/R28 a hard-wired production cell works without any PLC', () => {
  it('START button -> feeder + belt -> collector: belts are not held off by a controller that was never placed', async () => {
    const { createWorld, tick } = await import('../src/sim/orchestrator');
    type Cmd = import('../src/sim/signals').Command;
    const cmds: Cmd[] = [
      { k: 'place', id: 'ps', kind: 'supply', at: { x: 20, y: 25 } }, { k: 'place', id: 'go', kind: 'start', at: { x: 225, y: 25 } },
      { k: 'place', id: 'feed', kind: 'box-feeder', at: { x: 465, y: 225 } }, { k: 'place', id: 'belt', kind: 'belt-conveyor', at: { x: 455, y: 225 } },
      { k: 'place', id: 'bin', kind: 'collector', at: { x: 560, y: 225 } },
      { k: 'wire', id: 'a', from: 'ps.P24', to: 'go.A' }, { k: 'wire', id: 'b', from: 'go.B', to: 'feed.CMD_enable+' }, { k: 'wire', id: 'c', from: 'feed.M-', to: 'ps.M0' },
      { k: 'wire', id: 'd', from: 'go.B', to: 'belt.CMD_run+' }, { k: 'wire', id: 'e', from: 'belt.M-', to: 'ps.M0' },
      { k: 'wire', id: 'f', from: 'ps.P24', to: 'bin.CMD_enable+' }, { k: 'wire', id: 'g', from: 'bin.M-', to: 'ps.M0' },
      { k: 'setParam', id: 'feed', key: 'quantity', value: 3 }, { k: 'setParam', id: 'feed', key: 'materialId', value: 2 }, { k: 'setParam', id: 'feed', key: 'rateMs', value: 700 },
      { k: 'setParam', id: 'belt', key: 'lengthMm', value: 800 }, { k: 'setParam', id: 'belt', key: 'speedMmS', value: 500 },
    ];
    let w = tick(createWorld(), cmds).world;
    expect(w.project.components.some(c => c.kind === 'plc')).toBe(false);
    w = tick(w, [{ k: 'run' }, { k: 'operate', id: 'go', pressed: true }]).world;
    for (let i = 0; i < 320; i++) w = tick(w).world;
    expect(w.plantWorld.signals.bin.count).toBe(3);
    expect(w.plantWorld.world.bodies).toHaveLength(0);
    // Releasing START stops the whole cell (consequence of the wiring, not a canned animation).
    let stopped = tick(createWorld(), cmds).world;
    stopped = tick(stopped, [{ k: 'run' }]).world;
    for (let i = 0; i < 100; i++) stopped = tick(stopped).world;
    expect(stopped.plantWorld.world.spawnedCount).toBe(0);
  });
});

describe('R26 feeder exit: a magazine does not discharge onto an occupied exit', () => {
  const feeder = place('feed', 'box-feeder', 0, 0, { rateMs: 100, materialId: 2 });
  const away = place('away', 'belt-conveyor', 600, 0, { lengthMm: 1600, speedMmS: 800 });
  it('with nothing to carry bodies away it holds after the first one instead of stacking overlapping bodies', () => {
    const r = run([feeder], freshWorld(), { feed: { enable: true } }, 60);
    expect(r.world.spawnedCount).toBe(1);
    expect(r.world.bodies).toHaveLength(1);
    expect(conserved(r.world)).toBe(true);
  });
  it('resumes at once when the exit clears, and never overlaps two bodies at the exit', () => {
    const items = [feeder, away];
    let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
    for (let i = 0; i < 100; i++) {
      r = stepScene(r, items, PLANT_EQUIPMENT, { feed: { enable: true }, away: { run: true } });
      for (const a of r.world.bodies) for (const b of r.world.bodies) if (a.id < b.id)
        expect(Math.abs(a.pos.x - b.pos.x) < (a.size.x + b.size.x) / 2 - 1 && Math.abs(a.pos.y - b.pos.y) < (a.size.y + b.size.y) / 2 - 1, `${a.id}/${b.id} overlap at scan ${i}`).toBe(false);
    }
    expect(r.world.spawnedCount).toBeGreaterThan(5);
  });
});
