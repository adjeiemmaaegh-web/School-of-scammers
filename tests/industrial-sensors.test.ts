import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { materialById, materialSpawn } from '../src/plant/world/materials';
import type { EquipmentPlacement, World } from '../src/plant/world/types';
import type { SpawnSpec } from '../src/plant/world/bodies';

const sensor = (kind: string, params: Record<string, number> = {}): EquipmentPlacement => ({ id: 's', kind, originMm: vec(0, 0, 0), yawDeg: 0, params });
const box = (x: number, y: number, tags: Record<string, string | number | boolean> = {}, size = vec(100, 100, 80)): SpawnSpec =>
  ({ size, massKg: 1, pos: vec(x, y, 0), tags }); // resting on the floor (a free body would fall)
const world = (...specs: SpawnSpec[]): World => specs.reduce((w, s) => spawnBody(w, 't', s), freshWorld());
const read = (item: EquipmentPlacement, w: World, scans = 3, fault: string | null = null) => {
  let r = freshRuntime(w, [item], PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, [item], PLANT_EQUIPMENT, {}, fault ? { s: fault } : {});
  return r.signals.s;
};

describe('R04/R17 retroreflective photoeye with continuous aim (R21)', () => {
  const retro = (p: Record<string, number> = {}) => sensor('retro-photoeye', { responseMs: 0, beamHeightMm: 40, ...p });
  it('is broken by a body between the head and the reflector, not by bodies beyond it or beside it', () => {
    expect(read(retro(), world(box(300, 0))).present).toBe(true);
    expect(read(retro({ rangeMm: 200 }), world(box(400, 0))).present).toBe(false); // beyond the reflector
    expect(read(retro(), world(box(300, 400))).present).toBe(false);               // beside the beam
    expect(read(retro(), world(box(-300, 0))).present).toBe(false);                // behind the head
  });
  it('can be aimed at any angle, independent of the 90 degree placement: 45 degrees finds the diagonal, not the axis', () => {
    const diagonal = world(box(300, 300)), axis = world(box(300, 0));
    expect(read(retro({ aimDeg: 45 }), diagonal).present).toBe(true);
    expect(read(retro({ aimDeg: 45 }), axis).present).toBe(false);
    expect(read(retro({ aimDeg: 0 }), diagonal).present).toBe(false);
    expect(read(retro({ aimDeg: -90 }), world(box(0, -300))).present).toBe(true);
    expect(() => read(retro({ aimDeg: 7 }), diagonal)).toThrow(/Invalid plant parameter aimDeg/); // 5 degree steps
  });
  it('shiny and clear targets behave physically: a reflective part is missed unless polarised; glass is transparent', () => {
    const metal = materialSpawn(materialById('metal-workpiece')!, vec(300, 0, 0));
    const glass = materialSpawn(materialById('bottle-glass')!, vec(300, 0, 0));
    expect(read(retro(), world(metal)).present).toBe(false);
    expect(read(retro({ polarised: 1 }), world(metal)).present).toBe(true);
    expect(read(retro({ polarised: 1 }), world(glass)).present).toBe(false);
    expect(read(retro(), world(box(300, 0))).present).toBe(true);
  });
  it('only sees bodies at its beam height', () => {
    expect(read(retro({ beamHeightMm: 40 }), world(box(300, 0))).present).toBe(true);    // the box spans z 0..80
    expect(read(retro({ beamHeightMm: 200 }), world(box(300, 0))).present).toBe(false);  // a beam above it passes over
  });
  it('responds to its fault set', () => {
    const target = world(box(300, 0)), empty = world();
    expect(read(retro(), empty, 3, 'sensor-stuck-on').present).toBe(true);
    expect(read(retro(), target, 3, 'sensor-stuck-off').present).toBe(false);
    expect(read(retro({ rangeMm: 400 }), world(box(300, 0)), 3, 'dirty-lens').present).toBe(false); // range quartered to 100
    expect(read(retro(), target, 3, 'sensor-misaligned').present).toBe(false);                      // head turned 25 degrees
  });
  it('honours its response delay', () => {
    expect(read(sensor('retro-photoeye', { responseMs: 200, beamHeightMm: 40 }), world(box(300, 0)), 3).present).toBe(false);
    expect(read(sensor('retro-photoeye', { responseMs: 200, beamHeightMm: 40 }), world(box(300, 0)), 12).present).toBe(true);
  });
});

describe('R04/R17 laser displacement sensor', () => {
  const laser = (p: Record<string, number> = {}) => sensor('laser-distance', { beamHeightMm: 40, ...p });
  it('reports the distance to the nearest surface along its aim, in millimetres', () => {
    expect(read(laser(), world(box(400, 0))).distanceMm).toBe(350);      // front face of a 100 mm box centred at 400
    expect(read(laser(), world(box(400, 0))).present).toBe(true);
    expect(read(laser(), world(box(400, 0), box(250, 0))).distanceMm).toBe(200); // nearest of two
    expect(read(laser({ aimDeg: 90 }), world(box(0, 500))).distanceMm).toBe(450);
    expect(read(laser({ aimDeg: 45 }), world(box(300, 300))).distanceMm).toBeGreaterThan(350);
  });
  it('reads a cylinder by its curved surface, and the full range when nothing is in view', () => {
    const bottle = materialSpawn(materialById('bottle-glass')!, vec(300, 0, 0));
    expect(read(laser(), world(bottle)).distanceMm).toBe(265);           // 300 - 35 radius
    const none = read(laser({ rangeMm: 500 }), world());
    expect(none.present).toBe(false); expect(none.distanceMm).toBe(500);
    expect(read(laser({ rangeMm: 200 }), world(box(400, 0))).present).toBe(false);
  });
  it('ignores bodies that do not cross its beam height, and follows its faults', () => {
    expect(read(laser({ beamHeightMm: 600 }), world(box(400, 0))).present).toBe(false);
    expect(read(laser(), world(box(400, 0)), 3, 'sensor-stuck-off').present).toBe(false);
    expect(read(laser({ rangeMm: 500 }), world(box(400, 0)), 3, 'dirty-lens').present).toBe(false);
    expect(read(laser(), world(box(400, 0)), 3, 'sensor-misaligned').present).toBe(false);
  });
});

describe('R04/R17 RFID reader', () => {
  const rfid = (p: Record<string, number> = {}) => sensor('rfid-reader', p);
  it('reads the numeric tag of the tagged body in its field and ignores untagged bodies', () => {
    const r = read(rfid(), world(box(60, 0, { rfid: 7 })));
    expect(r.present).toBe(true); expect(r.tagId).toBe(7); expect(r.readCount).toBe(1);
    expect(read(rfid(), world(box(60, 0))).present).toBe(false);
    expect(read(rfid(), world(box(400, 0, { rfid: 7 }))).present).toBe(false);
  });
  it('reads the nearest of several tags, and counts each new tag once while it stays in the field', () => {
    expect(read(rfid(), world(box(120, 0, { rfid: 2 }), box(30, 0, { rfid: 9 }))).tagId).toBe(9);
    const item = rfid();
    let r = freshRuntime(world(box(60, 0, { rfid: 4 })), [item], PLANT_EQUIPMENT);
    for (let i = 0; i < 10; i++) r = stepScene(r, [item], PLANT_EQUIPMENT, {});
    expect(r.signals.s.readCount).toBe(1);
  });
  it('is detuned by metal (half range) and by its faults', () => {
    expect(read(rfid({ rangeMm: 150 }), world(box(100, 0, { rfid: 3 }))).present).toBe(true);
    expect(read(rfid({ rangeMm: 150 }), world(box(100, 0, { rfid: 3, metal: true }))).present).toBe(false);
    expect(read(rfid({ rangeMm: 150 }), world(box(50, 0, { rfid: 3, metal: true }))).present).toBe(true);
    expect(read(rfid(), world(box(60, 0, { rfid: 3 })), 3, 'tag-unreadable').present).toBe(false);
    expect(read(rfid({ rangeMm: 150 }), world(box(100, 0, { rfid: 3 })), 3, 'antenna-detuned').present).toBe(false);
  });
  it('a feeder can tag every body with a sequential number, and the default leaves bodies untagged', () => {
    const run = (rfidTags: number) => {
      const items: EquipmentPlacement[] = [{ id: 'feed', kind: 'box-feeder', originMm: vec(0, 0, 0), yawDeg: 0, params: { rateMs: 200, quantity: 3, rfidTags } }];
      let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
      for (let i = 0; i < 40; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { feed: { enable: true } });
      return r.world.bodies;
    };
    expect(run(1).map(b => b.tags.rfid)).toEqual([1, 2, 3]);
    expect(run(0).every(b => b.tags.rfid === undefined)).toBe(true);
  });
});

describe('R04/R17/R05 machine-vision inspection sensor', () => {
  const vision = (p: Record<string, number> = {}) => sensor('vision-sensor', p);
  const carton = (x = 0) => materialSpawn(materialById('carton-small')!, vec(x, 0, 0));
  it('measures the body and classifies its category', () => {
    const r = read(vision(), world(carton()));
    expect(r.present).toBe(true); expect(r.lengthMm).toBe(160); expect(r.classId).toBe(1); // package
    expect(read(vision(), world(materialSpawn(materialById('bottle-glass')!, vec(0, 0, 0)))).classId).toBe(2); // container
    expect(read(vision(), world(materialSpawn(materialById('metal-workpiece')!, vec(0, 0, 0)))).classId).toBe(4);
    expect(read(vision(), world(box(1000, 0))).present).toBe(false); // outside the field of view
  });
  it('passes or rejects by size tolerance', () => {
    expect(read(vision({ expectedLengthMm: 160, toleranceMm: 10 }), world(carton())).pass).toBe(true);
    expect(read(vision({ expectedLengthMm: 160, toleranceMm: 10 }), world(materialSpawn(materialById('carton')!, vec(0, 0, 0)))).pass).toBe(false);
    expect(read(vision({ expectedLengthMm: 300, toleranceMm: 200 }), world(carton())).pass).toBe(true);
    expect(read(vision(), world(carton())).pass).toBe(true); // size check off
  });
  it('checks bottle capping and processing stage', () => {
    const open = materialSpawn(materialById('bottle-glass')!, vec(0, 0, 0));
    const capped = materialSpawn(materialById('bottle-glass')!, vec(0, 0, 0), { tags: { capped: true } });
    expect(read(vision({ requireCapped: 1 }), world(open)).pass).toBe(false);
    expect(read(vision({ requireCapped: 1 }), world(capped)).pass).toBe(true);
    expect(read(vision({ requireCapped: 0 }), world(open)).pass).toBe(true);
    expect(read(vision({ requireStage: 4 }), world(carton())).pass).toBe(true);                  // finished
    expect(read(vision({ requireStage: 3 }), world(carton())).pass).toBe(false);                 // needs assembled
    expect(read(vision({ requireStage: 3 }), world(materialSpawn(materialById('assembled-product')!, vec(0, 0, 0)))).pass).toBe(true);
  });
  it('faults have visible consequences: bad lighting biases the measurement, an offline camera sees nothing', () => {
    const p = { expectedLengthMm: 160, toleranceMm: 10 };
    expect(read(vision(p), world(carton()), 3, 'lighting-fault').lengthMm).toBe(172);
    expect(read(vision(p), world(carton()), 3, 'lighting-fault').pass).toBe(false);
    expect(read(vision(p), world(carton()), 3, 'camera-offline').present).toBe(false);
  });
});

describe('R04 end to end through the real engine: vision inspection rejects out-of-tolerance product on a PLC', () => {
  it('feeder (mixed sizes) -> belt -> vision sensor -> PLC: the reject output follows exactly the bodies that are out of tolerance', async () => {
    const { createWorld, tick } = await import('../src/sim/orchestrator');
    type Cmd = import('../src/sim/signals').Command;
    // Plant coordinates are (x - 455) x 10 mm.
    const cmds: Cmd[] = [
      { k: 'place', id: 'ps', kind: 'supply', at: { x: 20, y: 25 } }, { k: 'place', id: 'plc', kind: 'plc16', at: { x: 120, y: 25 } },
      { k: 'place', id: 'go', kind: 'start', at: { x: 220, y: 25 } },
      { k: 'place', id: 'feed', kind: 'box-feeder', at: { x: 425, y: 225 } }, { k: 'place', id: 'belt', kind: 'belt-conveyor', at: { x: 455, y: 225 } },
      { k: 'place', id: 'cam', kind: 'vision-sensor', at: { x: 455, y: 225 } },
      { k: 'wire', id: 'a', from: 'ps.P24', to: 'plc.L+' }, { k: 'wire', id: 'b', from: 'ps.M0', to: 'plc.M' },
      { k: 'wire', id: 'c', from: 'ps.P24', to: 'go.A' }, { k: 'wire', id: 'd', from: 'go.B', to: 'feed.CMD_enable+' }, { k: 'wire', id: 'e', from: 'feed.M-', to: 'ps.M0' },
      { k: 'wire', id: 'f', from: 'go.B', to: 'belt.CMD_run+' }, { k: 'wire', id: 'g', from: 'belt.M-', to: 'ps.M0' },
      { k: 'wire', id: 'h', from: 'ps.P24', to: 'cam.L+' }, { k: 'wire', id: 'i', from: 'ps.M0', to: 'cam.M' },
      { k: 'wire', id: 'j', from: 'cam.OUT_present', to: 'plc.I0.0' }, { k: 'wire', id: 'k', from: 'cam.OUT_pass', to: 'plc.I0.1' },
      { k: 'setParam', id: 'feed', key: 'materialId', value: 2 }, { k: 'setParam', id: 'feed', key: 'variationPct', value: 40 },
      { k: 'setParam', id: 'feed', key: 'quantity', value: 8 }, { k: 'setParam', id: 'feed', key: 'rateMs', value: 700 },
      { k: 'setParam', id: 'belt', key: 'lengthMm', value: 800 }, { k: 'setParam', id: 'belt', key: 'speedMmS', value: 400 },
      { k: 'setParam', id: 'cam', key: 'expectedLengthMm', value: 160 }, { k: 'setParam', id: 'cam', key: 'toleranceMm', value: 20 },
      { k: 'setParam', id: 'cam', key: 'fieldMm', value: 100 },
    ];
    // A configurable plc16 has neutral tags (In0.., Out0..): In0 = part present, In1 = part passes, Out0 = reject.
    const st = 'VAR_INPUT\n  In0 : BOOL;\n  In1 : BOOL;\nEND_VAR\nVAR_OUTPUT\n  Out0 : BOOL;\nEND_VAR\nOut0 := In0 AND NOT In1;';
    let w = tick(createWorld(), cmds).world;
    expect(w.lastError).toBeNull();
    w = tick(w, [{ k: 'loadST', source: st }, { k: 'run' }, { k: 'operate', id: 'go', pressed: true }]).world;
    const lengths = new Map<string, number>();
    let rejectScans = 0, seenScans = 0;
    for (let i = 0; i < 330; i++) {
      w = tick(w).world;
      const cam = w.plantWorld.signals.cam;
      if (cam.present) {
        seenScans++;
        if (w.plcs.plc?.coils?.Out0 === true) rejectScans++;
        // independent truth: lengths of bodies the camera actually has in view
        for (const b of w.plantWorld.world.bodies) if (Math.abs(b.pos.x - 0) <= 50 && !lengths.has(b.id)) lengths.set(b.id, Math.round(b.size.x));
      }
    }
    const outOfTolerance = [...lengths.values()].filter(l => Math.abs(l - 160) > 20).length;
    expect(lengths.size).toBeGreaterThanOrEqual(6);                 // the camera inspected most of the run
    expect(seenScans).toBeGreaterThan(0);
    expect(outOfTolerance).toBeGreaterThan(0);                      // the mixed run really contained rejects...
    expect(outOfTolerance).toBeLessThan(lengths.size);              // ...and good parts
    expect(rejectScans).toBeGreaterThan(0);                         // so the PLC raised its reject output
    expect(rejectScans).toBeLessThan(seenScans);                    // but not for every part
  });
});

describe('R04/R17 incremental encoder (measuring wheel)', () => {
  const belt: EquipmentPlacement = { id: 'belt', kind: 'belt-conveyor', originMm: vec(0, 0, 0), yawDeg: 0, params: { lengthMm: 1200, widthMm: 300, speedMmS: 200 } };
  const enc = (p: Record<string, number> = {}, f: string | null = null) => ({ item: sensor('incremental-encoder', p), f });
  const ride = (e: { item: EquipmentPlacement; f: string | null }, scans: number, inputs: Record<string, Record<string, boolean | number>> = { belt: { run: true } }) => {
    const items = [belt, e.item];
    const w = spawnBody(freshWorld(), 't', { size: vec(100, 100, 80), massKg: 1, pos: vec(-200, 0, 120), supportedBy: 'belt', tags: {} });
    let r = freshRuntime(w, items, PLANT_EQUIPMENT);
    for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, inputs, e.f ? { s: e.f } : {});
    return r;
  };
  it('counts pulses in proportion to the distance the product travels under it, at the set resolution', () => {
    const r = ride(enc({ pulsesPerMm: 4 }), 30);       // body starts under the wheel's reach (100 mm) and rides forward
    const count = r.signals.s.count as number;
    expect(count).toBeGreaterThan(0);
    const coarse = ride(enc({ pulsesPerMm: 2 }), 30).signals.s.count as number;
    expect(count / coarse).toBeGreaterThan(1.7); expect(count / coarse).toBeLessThan(2.3);
  });
  it('reports speed and the moving flag, and is quiet when the belt stops', () => {
    const run = ride(enc(), 14).signals.s, stopped = ride(enc(), 14, { belt: { run: false } }).signals.s;
    expect(run.moving).toBe(true); expect(Math.abs(run.speedMmS as number)).toBeGreaterThan(50);
    expect(stopped.moving).toBe(false); expect(stopped.count).toBe(0);
  });
  it('counts up along its aim and down against it (direction-aware)', () => {
    const fwd = ride(enc({ aimDeg: 0 }), 30).signals.s.count as number;
    const back = ride(enc({ aimDeg: 180 }), 30).signals.s.count as number;
    expect(fwd).toBeGreaterThan(0); expect(back).toBeLessThan(0);
    expect(Math.abs(fwd + back)).toBeLessThanOrEqual(2);
  });
  it('lost pulses and a dead encoder are observable faults', () => {
    const good = ride(enc(), 30).signals.s.count as number;
    const slip = ride(enc({}, 'encoder-slip'), 30).signals.s.count as number;
    expect(slip).toBeLessThan(good); expect(slip).toBeGreaterThan(good * 0.5);
    expect(ride(enc({}, 'encoder-dead'), 30).signals.s.count).toBe(0);
  });
});
