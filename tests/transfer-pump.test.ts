import { describe, expect, it } from 'vitest';
import { freshWorld } from '../src/plant/world/bodies';
import { freshRuntime, stepScene } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, params: Record<string, number> = {}, y = 0, yawDeg: 0 | 90 | 180 | 270 = 0): EquipmentPlacement => ({ id, kind, originMm: vec(x, y, 0), yawDeg, params });
type Inputs = Record<string, Record<string, boolean | number>>;
/** Two tanks with a transfer pump between them; the source starts with `src` ml. */
function plant(src: number, dst: number, pump: Record<string, number> = {}, tankParams: Record<string, number> = {}) {
  const items = [P('a', 'process-tank', -1500, { capacityMl: 10000, ...tankParams }), P('pump', 'transfer-pump', 0, pump), P('b', 'process-tank', 1500, { capacityMl: 10000, ...tankParams })];
  let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
  r = { ...r, world: { ...r.world, model: { ...r.world.model, a: { ...(r.world.model.a ?? PLANT_EQUIPMENT['process-tank'].fresh(items[0].params)), levelMl: src },
    b: { ...(r.world.model.b ?? PLANT_EQUIPMENT['process-tank'].fresh(items[2].params)), levelMl: dst } } } };
  return { items, r };
}
const run = (p: ReturnType<typeof plant>, inputs: Inputs, scans: number, faults: Record<string, string | null> = {}) => {
  let r = p.r;
  for (let i = 0; i < scans; i++) r = stepScene(r, p.items, PLANT_EQUIPMENT, inputs, faults);
  return r;
};
const lv = (r: ReturnType<typeof run>, id: string) => r.world.model[id].levelMl;

describe('R11 transfer pump between tanks', () => {
  it('does nothing until commanded', () => {
    const r = run(plant(5000, 0), {}, 40);
    expect(lv(r, 'a')).toBe(5000); expect(lv(r, 'b')).toBe(0);
  });
  it('moves liquid from the tank behind to the tank ahead and conserves volume exactly', () => {
    const r = run(plant(5000, 1000), { pump: { run: true } }, 100);     // 5 s
    expect(lv(r, 'b')).toBeGreaterThan(3000);
    expect(lv(r, 'a') + lv(r, 'b')).toBeCloseTo(6000, 1);
    expect(r.signals.pump.running).toBe(true);
    expect(r.signals.pump.flowMlS as number).toBeGreaterThan(300);
  });
  it('speed scales the flow', () => {
    const slow = lv(run(plant(9000, 0), { pump: { run: true, speedPct: 25 } }, 50), 'b');
    const fast = lv(run(plant(9000, 0), { pump: { run: true, speedPct: 100 } }, 50), 'b');
    expect(fast).toBeGreaterThan(slow * 3);
  });
  it('pump curve: delivery falls as the destination rises above the source and stops at shut-off head', () => {
    // 100 cm2 and 40 cm shut-off: the pump can lift the destination at most 4000 ml above the source.
    const small = { areaCm2: 100, shutoffHeadCm: 40 };
    const early = run(plant(6000, 0, small), { pump: { run: true } }, 5);
    const settled = run(plant(6000, 0, small), { pump: { run: true } }, 1200);
    expect(early.signals.pump.flowMlS as number).toBeGreaterThan(900);               // free delivery while the destination is low
    expect(lv(settled, 'b') - lv(settled, 'a')).toBeGreaterThan(3900);               // approaches the shut-off difference ...
    expect(lv(settled, 'b') - lv(settled, 'a')).toBeLessThanOrEqual(4000.5);        // ... and never exceeds it
    expect(settled.signals.pump.flowMlS as number).toBeLessThan(10);
    const pushed = run(plant(1000, 6000, small), { pump: { run: true } }, 100);
    expect(lv(pushed, 'b')).toBeLessThanOrEqual(6000);                     // destination beyond shut-off head is never pumped higher
    expect(lv(pushed, 'a')).toBe(1000);
    expect(pushed.signals.pump.flowMlS).toBe(0);
  });
  it('dry running delivers nothing and is reported; an empty source never goes negative', () => {
    const r = run(plant(0, 0), { pump: { run: true } }, 40);
    expect(lv(r, 'a')).toBe(0); expect(lv(r, 'b')).toBe(0);
    expect(r.signals.pump.dryRun).toBe(true);
    const drained = run(plant(100, 0), { pump: { run: true } }, 100);
    expect(lv(drained, 'a')).toBe(0); expect(lv(drained, 'b')).toBeCloseTo(100, 1);
  });
  it('never overfills the destination tank', () => {
    const r = run(plant(9000, 9500, {}, { capacityMl: 10000 }), { pump: { run: true } }, 200);
    expect(lv(r, 'b')).toBeLessThanOrEqual(10000);
    expect(lv(r, 'a') + lv(r, 'b')).toBeCloseTo(18500, 1);
  });
  it('pipe restriction, a blocked pipe and a worn impeller each reduce delivery', () => {
    const base = lv(run(plant(9000, 0), { pump: { run: true } }, 30), 'b');
    expect(lv(run(plant(9000, 0, { pipeLossPct: 50 }), { pump: { run: true } }, 30), 'b')).toBeLessThan(base * 0.6);
    const blocked = run(plant(9000, 0), { pump: { run: true } }, 30, { pump: 'blocked-pipe' });
    expect(lv(blocked, 'b')).toBe(0); expect(blocked.signals.pump.blocked).toBe(true);
    expect(lv(run(plant(9000, 0), { pump: { run: true } }, 30, { pump: 'worn-impeller' }), 'b')).toBeLessThan(base * 0.6);
  });
  it('direction follows the pump orientation: rotated 180 degrees it pumps the other way', () => {
    const items = [P('a', 'process-tank', -1500, { capacityMl: 10000 }), P('pump', 'transfer-pump', 0, {}, 0, 180), P('b', 'process-tank', 1500, { capacityMl: 10000 })];
    let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
    r = { ...r, world: { ...r.world, model: { ...r.world.model, b: { ...PLANT_EQUIPMENT['process-tank'].fresh(items[2].params), levelMl: 5000 }, a: PLANT_EQUIPMENT['process-tank'].fresh(items[0].params) } } };
    for (let i = 0; i < 60; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { pump: { run: true } });
    expect(lv(r, 'a')).toBeGreaterThan(1000); expect(lv(r, 'b')).toBeLessThan(4000);
  });
  it('a tank out of reach, or off to the side, is not connected', () => {
    const items = [P('a', 'process-tank', -1500, { capacityMl: 10000 }), P('pump', 'transfer-pump', 0, { reachMm: 1000 }), P('b', 'process-tank', 1500, { capacityMl: 10000 })];
    let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
    r = { ...r, world: { ...r.world, model: { ...r.world.model, a: { ...PLANT_EQUIPMENT['process-tank'].fresh(items[0].params), levelMl: 5000 } } } };
    for (let i = 0; i < 40; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { pump: { run: true } });
    expect(lv(r, 'a')).toBe(5000); expect(lv(r, 'b')).toBe(0);
  });
});
