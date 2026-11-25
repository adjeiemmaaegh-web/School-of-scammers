import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, y: number, yawDeg: 0 | 90 | 180 | 270 = 0, params: Record<string, number> = {}): EquipmentPlacement => ({ id, kind, originMm: vec(x, y, 0), yawDeg, params });
/** Minor belt (+x) meets a main belt (+y) at x=0; the gate on the minor lane watches the main lane just upstream of the merge. */
const layout = (gate: Record<string, number> = {}) => [
  P('minor', 'belt-conveyor', -400, 0, 0, { lengthMm: 800 }),
  P('main', 'belt-conveyor', 150, 0, 90, { lengthMm: 2000 }),
  P('gate', 'merge-gate', -60, 0, 0, gate),
];
type Spawn = { id: string; x: number; y: number; carrier: string };
let ids: Record<string, string> = {};
function run(items: EquipmentPlacement[], bodies: Spawn[], inputs: Record<string, Record<string, boolean | number>>, scans: number,
  each?: (r: SceneRuntime, i: number) => void, faults: Record<string, string | null> = {}) {
  let w = freshWorld(); ids = {};
  for (const b of bodies) { w = spawnBody(w, 't', { size: vec(80, 80, 60), massKg: 1, pos: vec(b.x, b.y, 120), supportedBy: b.carrier }); ids[b.id] = w.bodies[w.bodies.length - 1].id; }
  let r = freshRuntime(w, items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) { r = stepScene(r, items, PLANT_EQUIPMENT, inputs, faults); each?.(r, i); }
  return r;
}
const belts = { minor: { run: true }, main: { run: true } };
const byId = (r: SceneRuntime, id: string) => r.world.bodies.find(b => b.id === ids[id])!;

describe('R03/R15 priority merge gate', () => {
  it('lane is free: the minor part passes the gate and joins the main belt', () => {
    const r = run(layout(), [{ id: 'm', x: -500, y: 0, carrier: 'minor' }], belts, 70);
    const m = byId(r, 'm');
    expect(m.pos.x).toBeGreaterThan(0);
    expect(m.supportedBy).toBe('main');
    expect(r.signals.gate.blocking).toBe(false);
  });
  it('a main-lane part in the zone blocks the minor part until the zone has been clear for the gap time', () => {
    let blockedUntil = -1, openedAt = -1, lastOccupied = -1, crossedWhileBlocking = false;
    const r = run(layout(), [{ id: 'm', x: -300, y: 0, carrier: 'minor' }, { id: 'p', x: 150, y: -400, carrier: 'main' }], belts, 300, (rt, i) => {
      const g = rt.signals.gate;
      if (g.zoneOccupied) lastOccupied = i;
      if (g.blocking) { blockedUntil = i; if (byId(rt, 'm').pos.x > -60) crossedWhileBlocking = true; }
      else if (openedAt < 0 && i > 0) openedAt = i;
    });
    expect(crossedWhileBlocking).toBe(false);
    expect(lastOccupied).toBeGreaterThan(0);                              // the main part really was in the zone for a while
    expect(blockedUntil).toBeGreaterThan(lastOccupied);                  // and the gate stayed shut AFTER it left (gap time)
    expect(byId(r, 'm').pos.x).toBeGreaterThan(0);                        // then the minor part merged
    expect(byId(r, 'm').pos.y).toBeGreaterThan(byId(r, 'p').pos.y - 3000);
    expect(r.signals.gate.released).toBe(1);
  });
  it('the gap time is respected: a longer clearMs keeps the gate shut longer after the zone empties', () => {
    const shut = (clearMs: number) => { let last = -1, lastOcc = -1; run(layout({ clearMs }), [{ id: 'm', x: -300, y: 0, carrier: 'minor' }, { id: 'p', x: 150, y: -400, carrier: 'main' }], belts, 300,
      (rt, i) => { if (rt.signals.gate.zoneOccupied) lastOcc = i; if (rt.signals.gate.blocking) last = i; }); return last - lastOcc; };
    expect(shut(2000) - shut(0)).toBeGreaterThanOrEqual(30);              // 2 s more = 40 scans at 50 ms (allowing slack)
  });
  it('a part outside the zone does not block: the zone is where the parameters say', () => {
    const r = run(layout(), [{ id: 'm', x: -300, y: 0, carrier: 'minor' }, { id: 'p', x: 150, y: 800, carrier: 'main' }], belts, 120);
    expect(byId(r, 'm').pos.x).toBeGreaterThan(0);                        // main part is far downstream of the zone
  });
  it('bypass opens the gate even with the zone occupied; stuck-closed never opens; stuck-open never blocks', () => {
    const occupied: Spawn[] = [{ id: 'm', x: -300, y: 0, carrier: 'minor' }, { id: 'p', x: 150, y: -300, carrier: 'main' }];
    const stopped = { minor: { run: true }, main: { run: false } };       // the main part sits in the zone
    const held = run(layout(), occupied, stopped, 100);
    expect(held.signals.gate.blocking).toBe(true); expect(byId(held, 'm').pos.x).toBeLessThan(-40);
    const bypass = run(layout(), occupied, { ...stopped, gate: { bypass: true } }, 100);
    expect(bypass.signals.gate.blocking).toBe(false); expect(byId(bypass, 'm').pos.x).toBeGreaterThan(-40);
    const closed = run(layout(), [{ id: 'm', x: -300, y: 0, carrier: 'minor' }], belts, 100, undefined, { gate: 'stuck-closed' });
    expect(closed.signals.gate.blocking).toBe(true); expect(byId(closed, 'm').pos.x).toBeLessThan(-40);
    const open = run(layout(), occupied, stopped, 100, undefined, { gate: 'stuck-open' });
    expect(open.signals.gate.blocking).toBe(false); expect(byId(open, 'm').pos.x).toBeGreaterThan(-40);
  });
  it('the zone follows the gate orientation: a gate turned 180 degrees watches the mirrored zone', () => {
    const turned = [P('minor', 'belt-conveyor', 400, 0, 180, { lengthMm: 800 }), P('main', 'belt-conveyor', -150, 0, 90, { lengthMm: 2000 }), P('gate', 'merge-gate', 60, 0, 180, {})];
    const r = run(turned, [{ id: 'm', x: 300, y: 0, carrier: 'minor' }, { id: 'p', x: -150, y: 300, carrier: 'main' }], { minor: { run: true }, main: { run: false } }, 60);
    expect(r.signals.gate.zoneOccupied).toBe(true);
    expect(r.signals.gate.blocking).toBe(true);
  });
  it('a gate turned 90 degrees measures the zone in its own frame (left of a +y gate is -x)', () => {
    const items = [P('minor', 'belt-conveyor', 0, -400, 90, { lengthMm: 800 }), P('main', 'belt-conveyor', 0, 150, 0, { lengthMm: 2000 }),
      P('gate', 'merge-gate', 0, -60, 90, { zoneLeftMm: 300 })];
    const stopped = { minor: { run: true }, main: { run: false } };
    const hit = run(items, [{ id: 'm', x: 0, y: -300, carrier: 'minor' }, { id: 'p', x: -300, y: 150, carrier: 'main' }], stopped, 40);
    expect(hit.signals.gate.zoneOccupied).toBe(true);
    const miss = run(items, [{ id: 'm', x: 0, y: -300, carrier: 'minor' }, { id: 'p', x: 300, y: 150, carrier: 'main' }], stopped, 40);
    expect(miss.signals.gate.zoneOccupied).toBe(false);          // the mirrored position is NOT in the zone
  });
  it('a body that is not on any carrier (falling, dropped) does not hold the gate shut', () => {
    const items = layout();
    let w = freshWorld();
    w = spawnBody(w, 't', { size: vec(80, 80, 60), massKg: 1, pos: vec(150, -300, 900), supportedBy: null });   // hovering in the zone
    let r = freshRuntime(w, items, PLANT_EQUIPMENT);
    r = stepScene(r, items, PLANT_EQUIPMENT, {});
    expect(r.signals.gate.zoneOccupied).toBe(false);
  });
});
