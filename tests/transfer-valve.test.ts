import { describe, expect, it } from 'vitest';
import { freshWorld } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, params: Record<string, number> = {}, y = 0, yawDeg: 0 | 90 | 180 | 270 = 0): EquipmentPlacement => ({ id, kind, originMm: vec(x, y, 0), yawDeg, params });
type Cmd = Record<string, boolean | number>;
type Level = { level: number; temp?: number };
/** Tanks a (behind) and b (ahead) with a gravity valve between them; optional third tank c off to the side wired by a second valve. */
function net(a: Level, b: Level, valve: Record<string, number> = {}, extra?: { c: Level }, bCapacity = 10000) {
  const items = [P('a', 'process-tank', -1500, { capacityMl: 10000 }), P('v', 'transfer-valve', 0, valve), P('b', 'process-tank', 1500, { capacityMl: bCapacity }),
    ...(extra ? [P('v2', 'transfer-valve', 1500 + 1500, valve), P('c', 'process-tank', 4500, { capacityMl: 10000 })] : [])];
  let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
  const model = { ...r.world.model };
  const set = (id: string, i: number, l: Level) => { model[id] = { ...PLANT_EQUIPMENT['process-tank'].fresh(items[i].params), levelMl: l.level, temperatureC: l.temp ?? 20 }; };
  set('a', 0, a); set('b', 2, b); if (extra) set('c', 4, extra.c);
  return { items, r: { ...r, world: { ...r.world, model } } };
}
const run = (n: ReturnType<typeof net>, cmd: (i: number) => Record<string, Cmd>, scans: number, faults: Record<string, string | null> = {}): SceneRuntime => {
  let r = n.r; for (let i = 0; i < scans; i++) r = stepScene(r, n.items, PLANT_EQUIPMENT, cmd(i), faults); return r;
};
const lv = (r: SceneRuntime, id: string) => r.world.model[id].levelMl;
const open = (pct = 100) => () => ({ v: { openingPct: pct } });

describe('R11 gravity transfer valve and tank networks', () => {
  it('a closed valve (and an unwired one) passes nothing', () => {
    const r = run(net({ level: 6000 }, { level: 0 }), () => ({}), 60);
    expect(lv(r, 'a')).toBe(6000); expect(lv(r, 'b')).toBe(0);
    expect(lv(run(net({ level: 6000 }, { level: 0 }), open(0), 60), 'b')).toBe(0);
  });
  it('liquid flows from the higher surface to the lower one, conserving volume, and the flow follows the opening', () => {
    const r = run(net({ level: 6000 }, { level: 0 }), open(100), 40);
    expect(lv(r, 'b')).toBeGreaterThan(500);
    expect(lv(r, 'a') + lv(r, 'b')).toBeCloseTo(6000, 1);
    const half = lv(run(net({ level: 6000 }, { level: 0 }), open(50), 20), 'b'), full = lv(run(net({ level: 6000 }, { level: 0 }), open(100), 20), 'b');
    expect(full / half).toBeGreaterThan(1.8); expect(full / half).toBeLessThan(2.2);
  });
  it('the direction follows the head: it works the other way when the tank ahead is higher', () => {
    const r = run(net({ level: 0 }, { level: 6000 }), open(100), 40);
    expect(lv(r, 'a')).toBeGreaterThan(500); expect(lv(r, 'a') + lv(r, 'b')).toBeCloseTo(6000, 1);
  });
  it('flow rises with the head (square-root law): a deeper difference flows faster', () => {
    const shallow = run(net({ level: 3000 }, { level: 0 }), open(100), 2).signals.v.flowMlS as number;
    const deep = run(net({ level: 12000 }, { level: 0 }, {}), open(100), 2).signals.v.flowMlS as number;
    expect(shallow).toBeGreaterThan(0); expect(deep / shallow).toBeGreaterThan(1.7); expect(deep / shallow).toBeLessThan(2.3);   // sqrt(4) = 2
  });
  it('the surfaces level out and never overshoot: with equal areas the final levels meet', () => {
    const r = run(net({ level: 6000 }, { level: 0 }, { maxFlowMlS: 2000 }), open(100), 1500);
    expect(Math.abs(lv(r, 'a') - lv(r, 'b'))).toBeLessThan(40);
    expect(lv(r, 'a') + lv(r, 'b')).toBeCloseTo(6000, 1);
    expect(r.signals.v.flowMlS as number).toBeLessThan(40);                              // and it has nearly stopped
  });
  it('it will not overfill the lower tank or over-drain the higher one', () => {
    const r = run(net({ level: 9500 }, { level: 9400 }, { maxFlowMlS: 5000, refHeadCm: 5 }), open(100), 200);
    expect(lv(r, 'a')).toBeLessThanOrEqual(10000); expect(lv(r, 'b')).toBeLessThanOrEqual(10000);
    expect(lv(r, 'a') + lv(r, 'b')).toBeCloseTo(18900, 1);
  });
  it('reports the head in centimetres (level difference over the cross-section), signed toward the tank behind', () => {
    expect(run(net({ level: 6000 }, { level: 0 }), open(0), 3).signals.v.headCm).toBe(12);            // 6000 ml / 500 cm2
    expect(run(net({ level: 0 }, { level: 2500 }), open(0), 3).signals.v.headCm).toBe(-5);
    expect(run(net({ level: 6000 }, { level: 0 }, { areaCm2: 1000 }), open(0), 3).signals.v.headCm).toBe(6);
  });
  it('a smaller destination tank is never overfilled, however large the head', () => {
    const r = run(net({ level: 9000 }, { level: 1900 }, { maxFlowMlS: 5000 }, undefined, 2000), open(100), 200);
    expect(lv(r, 'b')).toBeLessThanOrEqual(2000);
    expect(lv(r, 'a') + lv(r, 'b')).toBeCloseTo(10900, 1);
  });
  it('the liquid carries its temperature across: the receiving tank takes the volume-weighted mix', () => {
    const r = run(net({ level: 4000, temp: 80 }, { level: 4000, temp: 20 }, { areaCm2: 500 }), open(100), 1), moved0 = lv(r, 'b') - 4000;
    expect(moved0).toBe(0);                                                               // equal levels: no head, no flow, no mixing
    const q = run(net({ level: 6000, temp: 80 }, { level: 2000, temp: 20 }), open(100), 60);
    const moved = lv(q, 'b') - 2000;
    expect(moved).toBeGreaterThan(300);
    expect(q.world.model.a.temperatureC).toBeCloseTo(80, 3);                              // the source keeps its temperature
    expect(q.world.model.b.temperatureC).toBeCloseTo((20 * 2000 + 80 * moved) / (2000 + moved), 1);
  });
  it('faults: a blocked pipe passes nothing; a stuck valve keeps the opening it had', () => {
    expect(lv(run(net({ level: 6000 }, { level: 0 }), open(100), 60, { v: 'blocked-pipe' }), 'b')).toBe(0);
    const stuck = (() => { let r = net({ level: 6000 }, { level: 0 }).r; const n = net({ level: 6000 }, { level: 0 });
      for (let i = 0; i < 40; i++) r = stepScene(r, n.items, PLANT_EQUIPMENT, { v: { openingPct: i < 10 ? 100 : 0 } }, i >= 10 ? { v: 'valve-stuck' } : {});
      return r; })();
    expect(stuck.signals.v.open).toBe(true); expect(lv(stuck, 'b')).toBeGreaterThan(300);   // it stayed open although closed was commanded
  });
  it('a branching network: a valve to a third tank splits the liquid; each tank behind a valve is reached independently', () => {
    const n = net({ level: 8000 }, { level: 0 }, { maxFlowMlS: 1500 }, { c: { level: 0 } });
    const r = run(n, () => ({ v: { openingPct: 100 }, v2: { openingPct: 100 } }), 400);
    expect(lv(r, 'a') + lv(r, 'b') + lv(r, 'c')).toBeCloseTo(8000, 1);                       // nothing created or lost
    expect(lv(r, 'b')).toBeGreaterThan(500); expect(lv(r, 'c')).toBeGreaterThan(50);          // liquid reaches the second hop
    const onlyFirst = run(n, () => ({ v: { openingPct: 100 } }), 400);
    expect(lv(onlyFirst, 'c')).toBe(0);                                                       // the second valve stays shut: c is cut off
  });
  it('a tank out of reach or off the axis is not connected', () => {
    const far = net({ level: 6000 }, { level: 0 }, { reachMm: 1000 });
    const r = run(far, open(100), 60);
    expect(lv(r, 'b')).toBe(0); expect(lv(r, 'a')).toBe(6000);
  });
});
