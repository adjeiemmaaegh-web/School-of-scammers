import { describe, expect, it } from 'vitest';
import { conserved, freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { COMPONENTS } from '../src/components/registry';
import type { EquipmentPlacement } from '../src/plant/world/types';

const belt: EquipmentPlacement = { id: 'belt', kind: 'belt-conveyor', originMm: vec(0, 0, 0), yawDeg: 0, params: { lengthMm: 1600, widthMm: 300, speedMmS: 300 } };
const fence = (x: number, y = 0, yaw: 0 | 90 | 180 | 270 = 90, params: Record<string, number> = {}): EquipmentPlacement =>
  ({ id: 'fence', kind: 'safety-fence', originMm: vec(x, y, 0), yawDeg: yaw, params: { lengthMm: 1000, widthMm: 50, ...params } });
const door = (x = 0, params: Record<string, number> = {}): EquipmentPlacement =>
  ({ id: 'door', kind: 'guard-door', originMm: vec(x, 0, 0), yawDeg: 90, params: { lengthMm: 800, widthMm: 50, travelMs: 1000, ...params } });
const carton = (x: number) => ({ size: vec(100, 100, 80), massKg: 2, pos: vec(x, 0, 120), supportedBy: 'belt', tags: { material: 'carton' } });
const run = (items: EquipmentPlacement[], scans: number, inputs: Record<string, Record<string, boolean | number>> = {}, faults: Record<string, string | null> = {}, x = -400) => {
  let r = freshRuntime(spawnBody(freshWorld(), 't', carton(x)), items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { belt: { run: true }, ...inputs }, faults);
  return r;
};
const body = (r: ReturnType<typeof run>) => r.world.bodies[0];

describe('R20 safety fence panel', () => {
  it('is registered as an object with no terminals (it is a physical barrier, not a signal device)', () => {
    expect(COMPONENTS['safety-fence'].terminals).toEqual([]);
    expect(PLANT_EQUIPMENT['safety-fence'].params.map(p => p.key)).toEqual(['lengthMm', 'widthMm']);
  });
  it('physically stops conveyed material across its footprint; without it the carton passes', () => {
    const free = run([belt], 40);
    expect(body(free).pos.x).toBeGreaterThan(0);
    const blocked = run([belt, fence(0)], 40);
    expect(body(blocked).pos.x).toBeLessThan(0);                       // held on its approach side
    expect(body(blocked).tags.jammed).toBe(true);
    expect(body(blocked).tags.jammedByGate).toBe('fence');
    expect(conserved(blocked.world)).toBe(true);
  });
  it('only blocks where it stands: a fence beside the belt, or one behind the carton, does not', () => {
    expect(body(run([belt, fence(0, 600)], 40)).pos.x).toBeGreaterThan(0);        // 600 mm to the side
    expect(body(run([belt, fence(-700)], 40)).pos.x).toBeGreaterThan(-400);      // behind the start point
  });
  it('its length and thickness are real: a short panel off to one side leaves the lane open, a long one closes it', () => {
    expect(body(run([belt, fence(0, 400, 90, { lengthMm: 400 })], 40)).pos.x).toBeGreaterThan(0);   // spans y 200..600: misses y=0
    expect(body(run([belt, fence(0, 0, 90, { lengthMm: 400 })], 40)).pos.x).toBeLessThan(0);        // spans y -200..200: blocks
    expect(body(run([belt, fence(100, 0, 90, { widthMm: 200 })], 40)).pos.x).toBeLessThan(100);     // a thick barrier still holds
  });
});

describe('R20 interlocked guard door', () => {
  it('is registered with its coil, supply and interlock outputs', () => {
    const names = COMPONENTS['guard-door'].terminals.map(t => t.name);
    for (const t of ['CMD_open+', 'M-', 'L+', 'M', 'OUT_closed', 'OUT_open']) expect(names).toContain(t);
  });
  it('a closed door holds material; commanding it open lets the carton through; it stops material again when it closes', () => {
    const items = [belt, door()];
    const closed = run(items, 40);
    expect(body(closed).pos.x).toBeLessThan(0); expect(body(closed).tags.jammedByGate).toBe('door');
    // open the door from the start: after its 1 s travel the carton passes
    const opened = run(items, 80, { door: { open: true } });
    expect(body(opened).pos.x).toBeGreaterThan(0);
    expect(opened.signals.door.open).toBe(true); expect(opened.signals.door.closed).toBe(false);
    // second carton behind a door that is closing again
    let r = freshRuntime(spawnBody(freshWorld(), 't', carton(-450)), items, PLANT_EQUIPMENT);
    for (let i = 0; i < 24; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { belt: { run: true }, door: { open: true } });
    expect(r.signals.door.open).toBe(true);
    for (let i = 0; i < 40; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { belt: { run: true }, door: { open: false } });
    expect(r.signals.door.closed).toBe(true);
  });
  it('the door interlock contact reflects the real door position and the travel time is a setting', () => {
    const at = (travelMs: number, scans: number) => run([door(0, { travelMs })], scans, { door: { open: true } }).signals.door;
    expect(at(1000, 10).open).toBe(false); expect(at(1000, 10).closed).toBe(false);   // part-way: neither closed nor fully open
    expect(at(1000, 24).open).toBe(true);
    expect(at(3000, 24).open).toBe(false);                                           // slower door still travelling
    expect(run([door()], 3).signals.door.closed).toBe(true);
  });
  it('a jammed door will not open, and a welded interlock contact reports CLOSED with the door open (the dangerous failure)', () => {
    const jammed = run([door()], 40, { door: { open: true } }, { door: 'door-jammed' });
    expect(jammed.signals.door.closed).toBe(true); expect(jammed.signals.door.open).toBe(false);
    const welded = run([door()], 40, { door: { open: true } }, { door: 'interlock-stuck-closed' });
    expect(welded.signals.door.open).toBe(true);     // physically open...
    expect(welded.signals.door.closed).toBe(true);   // ...yet the contact still says closed
  });
});

describe('R20 end to end through the real engine: the door interlock gates a machine', () => {
  it('a feeder runs only while the guard door is closed; opening the door stops it, closing resumes it, and a welded contact defeats the interlock', async () => {
    const { createWorld, tick } = await import('../src/sim/orchestrator');
    type Cmd = import('../src/sim/signals').Command;
    const build = () => tick(createWorld(), [
      { k: 'place', id: 'ps', kind: 'supply', at: { x: 20, y: 25 } }, { k: 'place', id: 'btn', kind: 'start', at: { x: 120, y: 25 } },
      { k: 'place', id: 'door', kind: 'guard-door', at: { x: 700, y: 400 } }, { k: 'place', id: 'feed', kind: 'box-feeder', at: { x: 425, y: 225 } },
      { k: 'place', id: 'away', kind: 'belt-conveyor', at: { x: 455, y: 225 } },
      { k: 'wire', id: 'h', from: 'ps.P24', to: 'away.CMD_run+' }, { k: 'wire', id: 'i', from: 'away.M-', to: 'ps.M0' },
      { k: 'setParam', id: 'away', key: 'lengthMm', value: 1600 }, { k: 'setParam', id: 'away', key: 'speedMmS', value: 800 },
      { k: 'wire', id: 'a', from: 'ps.P24', to: 'door.L+' }, { k: 'wire', id: 'b', from: 'ps.M0', to: 'door.M' },
      { k: 'wire', id: 'c', from: 'door.OUT_closed', to: 'feed.CMD_enable+' }, { k: 'wire', id: 'd', from: 'feed.M-', to: 'ps.M0' },
      { k: 'wire', id: 'e', from: 'ps.P24', to: 'btn.A' }, { k: 'wire', id: 'f', from: 'btn.B', to: 'door.CMD_open+' }, { k: 'wire', id: 'g', from: 'door.M-', to: 'ps.M0' },
      { k: 'setParam', id: 'feed', key: 'rateMs', value: 300 }, { k: 'setParam', id: 'door', key: 'travelMs', value: 500 },
    ] as Cmd[]).world;
    const spawned = (w: import('../src/sim/signals').WorldState) => w.plantWorld.world.spawnedCount;
    const scans = (w: import('../src/sim/signals').WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
    let w = tick(build(), [{ k: 'run' }]).world;
    expect(w.lastError).toBeNull();
    w = scans(w, 60);
    const closedRun = spawned(w);
    expect(closedRun).toBeGreaterThan(3);                                                  // door closed: the machine runs
    w = scans(tick(w, [{ k: 'operate', id: 'btn', pressed: true }]).world, 40);            // open the door
    const atOpen = spawned(w);
    w = scans(w, 60);
    expect(spawned(w)).toBe(atOpen);                                                       // door open: the machine stays stopped
    w = scans(tick(w, [{ k: 'operate', id: 'btn', pressed: false }]).world, 80);           // close it again
    expect(spawned(w)).toBeGreaterThan(atOpen);                                            // interlock made: the machine resumes
    // Dangerous failure: weld the interlock contact (paused), open the door, and the machine keeps running although the door is open.
    let f = tick(build(), [{ k: 'setPlantFault', id: 'door', fault: 'interlock-stuck-closed' }]).world;
    expect(f.lastError).toBeNull();
    f = scans(tick(f, [{ k: 'run' }, { k: 'operate', id: 'btn', pressed: true }]).world, 40);
    expect(f.plantWorld.signals.door.open).toBe(true);        // the door really is open...
    const whileOpen = spawned(f);
    f = scans(f, 60);
    expect(spawned(f)).toBeGreaterThan(whileOpen);            // ...yet the interlock still lets the machine run
  });
});
