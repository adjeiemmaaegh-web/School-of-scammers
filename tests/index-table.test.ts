import { describe, expect, it } from 'vitest';
import { freshWorld, spawnBody } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import { materialById, materialSpawn } from '../src/plant/world/materials';
import type { EquipmentPlacement, World } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, y: number, params: Record<string, number> = {}): EquipmentPlacement => ({ id, kind, originMm: vec(x, y, 0), yawDeg: 0, params });
const table = (params: Record<string, number> = {}) => P('t', 'index-table', 0, 0, params);
/** A part riding on the table at radius 300, angle 0 (the +x position). */
const onTable = (w: World = freshWorld(), x = 300, y = 0): World => spawnBody(w, 't', { size: vec(80, 80, 60), massKg: 1, pos: vec(x, y, 120), supportedBy: 't' });
type Cmd = Record<string, boolean | number>;
function run(items: EquipmentPlacement[], w: World, cmd: (i: number) => Record<string, Cmd>, scans: number, faults: Record<string, string | null> = {}, each?: (r: SceneRuntime, i: number) => void) {
  let r = freshRuntime(w, items, PLANT_EQUIPMENT);
  for (let i = 0; i < scans; i++) { r = stepScene(r, items, PLANT_EQUIPMENT, cmd(i), faults); each?.(r, i); }
  return r;
}
const pulse = (from: number, to: number) => (i: number) => ({ t: { index: i >= from && i < to } });
const pos = (r: SceneRuntime) => r.world.bodies[0].pos;
const sig = (r: SceneRuntime, n: string) => r.signals.t[n];

describe('R05/R18 indexing table', () => {
  it('one rising edge turns it one position: a four-position table carries the part a quarter turn about its centre', () => {
    const r = run([table()], onTable(), pulse(2, 6), 60);                          // 1.5 s per position = 30 scans
    expect(pos(r).x).toBeCloseTo(0, 0); expect(pos(r).y).toBeCloseTo(300, 0);
    expect(sig(r, 'position')).toBe(1); expect(sig(r, 'angleDeg')).toBe(90);
    expect(sig(r, 'inPosition')).toBe(true); expect(sig(r, 'busy')).toBe(false);
  });
  it('the part really rides round: halfway through a position it is halfway round the arc, and the table is busy', () => {
    const r = run([table()], onTable(), pulse(2, 40), 17);                         // about 0.75 s into the move
    const angle = Math.atan2(pos(r).y, pos(r).x) * 180 / Math.PI;
    expect(angle).toBeGreaterThan(30); expect(angle).toBeLessThan(60);
    expect(Math.hypot(pos(r).x, pos(r).y)).toBeCloseTo(300, 0);                    // it stays on its circle
    expect(sig(r, 'busy')).toBe(true); expect(sig(r, 'inPosition')).toBe(false);
  });
  it('a held command does not repeat: it takes a new rising edge for the next position', () => {
    const held = run([table()], onTable(), () => ({ t: { index: true } }), 200);
    expect(sig(held, 'position')).toBe(1);
    const twice = run([table()], onTable(), i => ({ t: { index: (i >= 2 && i < 4) || (i >= 40 && i < 42) } }), 100);
    expect(sig(twice, 'position')).toBe(2);
    expect(pos(twice).x).toBeCloseTo(-300, 0); expect(pos(twice).y).toBeCloseTo(0, 0);
  });
  it('an edge during a move is ignored (a PLC must wait for inPosition)', () => {
    const r = run([table()], onTable(), i => ({ t: { index: i % 6 < 3 } }), 40);   // many edges while the first move runs
    expect(sig(r, 'position')).toBe(1);
  });
  it('four positions bring the part home; the position wraps', () => {
    let at = 0;
    const r = run([table()], onTable(), i => ({ t: { index: i % 40 < 2 } }), 155, {}, (rr) => { at = rr.signals.t.position as number; });
    expect(at).toBe(0); expect(pos(r).x).toBeCloseTo(300, 0); expect(pos(r).y).toBeCloseTo(0, 0);
  });
  it('the position count sets the angle: eight positions turn 45 degrees at a time; the time setting sets the speed', () => {
    const eight = run([table({ stations: 8 })], onTable(), pulse(2, 4), 60);
    expect(Math.atan2(pos(eight).y, pos(eight).x) * 180 / Math.PI).toBeCloseTo(45, 0);
    expect(sig(eight, 'angleDeg')).toBe(45);
    const slow = run([table({ indexMs: 4000 })], onTable(), pulse(2, 4), 60);
    expect(sig(slow, 'busy')).toBe(true);                                          // 3 s in, still moving
    const fast = run([table({ indexMs: 500 })], onTable(), pulse(2, 4), 20);
    expect(sig(fast, 'busy')).toBe(false);
  });
  it('only parts standing on the table move; others stay where they are', () => {
    const w = onTable(spawnBody(freshWorld(), 't', { size: vec(80, 80, 60), massKg: 1, pos: vec(300, 600, 120), supportedBy: null }));
    const r = run([table()], w, pulse(2, 4), 60);
    const other = r.world.bodies.find(b => b.supportedBy === null)!;
    expect(other.pos.x).toBeCloseTo(300, 0);
    expect(other.pos.y).toBeGreaterThan(-100);                                     // it was never swung round the table
  });
  it('faults: a stuck table does not move, a slow one takes about three times as long', () => {
    const stuck = run([table()], onTable(), pulse(2, 4), 80, { t: 'table-stuck' });
    expect(pos(stuck).x).toBeCloseTo(300, 0); expect(sig(stuck, 'position')).toBe(0);
    const healthy = run([table()], onTable(), pulse(2, 4), 45);
    const slow = run([table()], onTable(), pulse(2, 4), 45, { t: 'index-slow' });
    expect(sig(healthy, 'position')).toBe(1); expect(sig(slow, 'busy')).toBe(true);
  });
  it('a process station beside the table works on the part that is indexed into its position', () => {
    // the station sits at the +y position, 90 degrees round from where the part starts
    const machine = P('m', 'process-station', 0, 300, { operation: 1, cycleMs: 800, lengthMm: 200, widthMm: 200 });
    const w = onTable(freshWorld());
    const items = [table(), machine];
    const r = run(items, w, i => ({ t: { index: i >= 2 && i < 4 }, m: { run: true } }), 90);
    expect(r.world.bodies[0].tags.stage).toBe('machined');
    expect(r.world.model.m.count).toBe(1);
    // before it is indexed in, the part is not at the station and nothing is machined
    const before = run(items, onTable(), () => ({ t: {}, m: { run: true } }), 60);
    expect(before.world.model.m.count).toBe(0);
  });
});
