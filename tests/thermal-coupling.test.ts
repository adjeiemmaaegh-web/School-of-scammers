import { describe, expect, it } from 'vitest';
import { freshWorld } from '../src/plant/world/bodies';
import { freshRuntime, stepScene, type SceneRuntime } from '../src/plant/world/runner';
import { PLANT_EQUIPMENT } from '../src/plant/equipment';
import { vec } from '../src/plant/world/math';
import type { EquipmentPlacement } from '../src/plant/world/types';

const P = (id: string, kind: string, x: number, params: Record<string, number> = {}): EquipmentPlacement => ({ id, kind, originMm: vec(x, 0, 0), yawDeg: 0, params });
type Cmd = Record<string, boolean | number>;
/** Tank `a` (level ml, temperature C) with a coupled heater beside it, and optionally a pump to a second tank `b`. */
function plant(level: number, opts: { heater?: Record<string, number>; tank?: Record<string, number>; withB?: { level: number; tempC: number }; aTemp?: number } = {}) {
  const items = [P('a', 'process-tank', -1500, { capacityMl: 10000, ...opts.tank }), P('h', 'heater', -1500 + 400, { coupling: 1, powerW: 5000, ...opts.heater }),
    ...(opts.withB ? [P('pump', 'transfer-pump', 0), P('b', 'process-tank', 1500, { capacityMl: 10000 })] : [])];
  let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
  const model = { ...r.world.model };
  model.a = { ...PLANT_EQUIPMENT['process-tank'].fresh(items[0].params), levelMl: level, temperatureC: opts.aTemp ?? 20 };
  if (opts.withB) model.b = { ...PLANT_EQUIPMENT['process-tank'].fresh(items[3].params), levelMl: opts.withB.level, temperatureC: opts.withB.tempC };
  return { items, r: { ...r, world: { ...r.world, model } } };
}
const run = (p: ReturnType<typeof plant>, cmd: (i: number) => Record<string, Cmd>, scans: number, faults: Record<string, string | null> = {}, each?: (r: SceneRuntime, i: number) => void) => {
  let r = p.r;
  for (let i = 0; i < scans; i++) { r = stepScene(r, p.items, PLANT_EQUIPMENT, cmd(i), faults); each?.(r, i); }
  return r;
};
const heat = (sp = 80) => () => ({ h: { enable: true, setpointC: sp } });
const temp = (r: SceneRuntime, id: string) => r.world.model[id].temperatureC;

describe('R11 thermal coupling: a heater warms the liquid in a tank', () => {
  it('heats by power x time / (mass x 4.186): 5 kW into 1 kg of water rises about 1.19 K per second', () => {
    const r = run(plant(1000), heat(), 100);                                     // 5 s
    expect(temp(r, 'a')).toBeGreaterThan(20 + 5 * 1.19 * 0.97); expect(temp(r, 'a')).toBeLessThan(20 + 5 * 1.19 * 1.03);
    expect(r.signals.h.temperatureC).toBe(temp(r, 'a'));                         // the heater reports the LIQUID temperature
    expect(r.signals.a.temperatureC).toBe(temp(r, 'a'));
  });
  it('more liquid heats more slowly, and the time scales with the mass', () => {
    const small = temp(run(plant(1000), heat(), 100), 'a') - 20;
    const big = temp(run(plant(4000), heat(), 100), 'a') - 20;
    expect(small / big).toBeGreaterThan(3.5); expect(small / big).toBeLessThan(4.5);
  });
  it('the element switches off at the setpoint and the temperature holds; the setpoint is the target', () => {
    const r = run(plant(1000), heat(40), 400);
    expect(temp(r, 'a')).toBeGreaterThanOrEqual(40); expect(temp(r, 'a')).toBeLessThan(41);
    expect(r.signals.h.atSetpoint).toBe(true);
    const hotter = run(plant(1000), heat(60), 900);                              // about 34 s at 1.19 K/s
    expect(temp(hotter, 'a')).toBeGreaterThanOrEqual(60); expect(temp(hotter, 'a')).toBeLessThan(61);
    expect(temp(run(plant(1000), heat(60), 400), 'a')).toBeLessThan(50);          // and not before that
  });
  it('without the enable command nothing heats; an open element does not heat either', () => {
    expect(temp(run(plant(1000), () => ({}), 100), 'a')).toBe(20);
    expect(temp(run(plant(1000), heat(), 100, { h: 'element-open' }), 'a')).toBe(20);
  });
  it('an empty tank cannot be heated: dry-fire is reported and the element does nothing', () => {
    const r = run(plant(0), heat(), 40);
    expect(temp(r, 'a')).toBe(20); expect(r.signals.h.dryFire).toBe(true);
    expect(run(plant(1000), heat(), 40).signals.h.dryFire).toBe(false);
  });
  it('the hard limit stops a stuck thermostat, a fouled element delivers less, and a heater out of reach heats nothing', () => {
    const stuck = run(plant(500, { heater: { maxC: 60 } }), heat(40), 600, { h: 'thermostat-stuck' });
    expect(temp(stuck, 'a')).toBeGreaterThan(50); expect(temp(stuck, 'a')).toBeLessThanOrEqual(60);   // ran past the setpoint, stopped at the limit
    const healthy = temp(run(plant(1000), heat(), 100), 'a') - 20;
    const fouled = temp(run(plant(1000), heat(), 100, { h: 'heat-loss' }), 'a') - 20;
    expect(fouled).toBeLessThan(healthy * 0.5);
    expect(temp(run(plant(1000, { heater: { reachMm: 200 } }), heat(), 100), 'a')).toBe(20);
  });
  it('stand-alone mode (the default) is unchanged: its own first-order temperature, the tank untouched', () => {
    const items = [P('a', 'process-tank', -1500, {}), P('h', 'heater', -1100, {})];
    let r = freshRuntime(freshWorld(), items, PLANT_EQUIPMENT);
    for (let i = 0; i < 200; i++) r = stepScene(r, items, PLANT_EQUIPMENT, { h: { enable: true, setpointC: 80 } });
    expect(r.signals.h.temperatureC as number).toBeGreaterThan(30);
    expect(r.world.model.a?.temperatureC ?? 20).toBe(20);
  });
  it('a tank cools toward the 20 C room only when its cooling time constant is set; fresh liquid arrives at room temperature', () => {
    const insulated = run(plant(1000, { aTemp: 70 }), () => ({}), 200, {}).world.model.a;
    const heaterOff = plant(1000, { aTemp: 70, tank: { coolingTauMs: 20000 }, heater: { coupling: 0 } });
    const cooling = run(heaterOff, () => ({}), 200);
    expect(insulated.temperatureC).toBe(70);
    expect(temp(cooling, 'a')).toBeLessThan(60); expect(temp(cooling, 'a')).toBeGreaterThan(20);
    const filling = run(plant(1000, { aTemp: 70 }), () => ({ a: { fill: true } }), 100);              // 5 s of 1 L/s room-temperature inflow
    expect(temp(filling, 'a')).toBeLessThan(70 - 10);
  });
  it('the pump carries temperature with the liquid: the destination becomes the volume-weighted mix, the source is unchanged', () => {
    const p = plant(5000, { aTemp: 80, withB: { level: 5000, tempC: 20 } });
    const r = run(p, () => ({ pump: { run: true } }), 120);                         // about 6 s: a few litres moved from a to b
    const moved = r.world.model.b.levelMl - 5000;
    expect(moved).toBeGreaterThan(1500);
    expect(temp(r, 'a')).toBeCloseTo(80, 3);
    expect(temp(r, 'b')).toBeCloseTo((20 * 5000 + 80 * moved) / (5000 + moved), 1);   // energy-weighted mix
    expect(temp(r, 'b')).toBeGreaterThan(30); expect(temp(r, 'b')).toBeLessThan(80);
  });
  it('transferring hot liquid into a cold tank and then heating that tank works as one system', () => {
    const p = plant(0, { heater: { powerW: 5000 }, withB: { level: 0, tempC: 20 }, aTemp: 20 });
    // fill a from the model, pump to b, nothing else: b gets a's temperature
    const q = plant(2000, { aTemp: 60, withB: { level: 0, tempC: 20 } });
    const r = run(q, () => ({ pump: { run: true } }), 200);
    expect(temp(r, 'b')).toBeCloseTo(60, 1);                                       // all of b's liquid came from a
    expect(p.items.length).toBe(4);
  });
});
