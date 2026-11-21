import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import { processControlDemo } from '../src/plant/demos/process-control';
import type { WorldState } from '../src/sim/signals';

const start = (faults: { id: string; fault: string }[] = []): WorldState => {
  let w = tick(createWorld(), [{ k: 'loadProject', project: processControlDemo() }, ...faults.map(f => ({ k: 'setPlantFault' as const, ...f }))]).world;
  expect(w.lastError).toBeNull();
  return tick(w, [{ k: 'run' }]).world;
};
const scans = (w: WorldState, n: number, each?: (w: WorldState) => void) => { for (let i = 0; i < n; i++) { w = tick(w).world; each?.(w); } return w; };
const level = (w: WorldState) => w.plantWorld.world.model.tank.levelMl;
const temp = (w: WorldState) => w.plantWorld.world.model.heater.temperatureC;
const tags = (w: WorldState) => renderSnapshot(w).plcs.plc.tagValues;

describe('Demonstration E: industrial process control (level, temperature, operator, alarms)', () => {
  it('analog inputs reach the PLC: the level and temperature readings follow the vessel and the heater', () => {
    const w = scans(start(), 100);
    const points = renderSnapshot(w).plcs.plc.io.analogInputs!;
    expect(points.find(p => p.terminal === 'AI0')).toMatchObject({ connected: true, unit: 'ml' });
    expect(points.find(p => p.terminal === 'AI1')).toMatchObject({ connected: true, unit: 'C' });
    expect(Math.abs((tags(w).Analog0 as number) - level(w))).toBeLessThan(120);   // sampled one scan behind the vessel
  });
  it('the level is brought up and then held inside the hysteresis band', () => {
    let low = Infinity, high = 0;
    const w = scans(start(), 1600, x => { if (x.tick > 0) { const l = level(x); if (x.tick > 400) { low = Math.min(low, l); high = Math.max(high, l); } } });
    expect(level(w)).toBeGreaterThan(3500);
    expect(low).toBeGreaterThan(3500); expect(high).toBeLessThan(7000);
  });
  it('the thermostat brings the heater to its band and holds it there, with the agitator running only while heating', () => {
    let low = Infinity, high = 0, mixWhileCold = false;
    scans(start(), 3200, x => {
      const t = temp(x);
      if (x.tick > 1200) { low = Math.min(low, t); high = Math.max(high, t); }
      if (!x.plantWorld.world.model.heater.engaged && x.plantWorld.world.model.mixer.engaged && x.tick > 100) mixWhileCold = true;
    });
    expect(low).toBeGreaterThan(55); expect(high).toBeLessThan(66);
    expect(mixWhileCold).toBe(false);
  });
  it('a leak is held off by the refill, but a blocked inlet empties the picture: level stays at zero and the low-level alarm and horn come on', () => {
    const leaking = scans(start([{ id: 'tank', fault: 'leak' }]), 1600);
    expect(level(leaking)).toBeGreaterThan(2500);
    expect(tags(leaking).LampLow).toBe(false);
    const blocked = scans(start([{ id: 'tank', fault: 'inlet-blocked' }]), 200);
    expect(level(blocked)).toBe(0);
    expect(tags(blocked).LampLow).toBe(true); expect(tags(blocked).Horn).toBe(true);
    expect(blocked.plantWorld.signals.panel.hornOn).toBe(true);
    expect(tags(blocked).Heat).toBe(false);                          // never heat an empty vessel
  });
  it('an open heating element is visible as a symptom: the PLC keeps commanding heat while the temperature never rises', () => {
    const w = scans(start([{ id: 'heater', fault: 'element-open' }]), 2000);
    expect(temp(w)).toBeLessThan(25);
    expect(tags(w).Heat).toBe(true);
  });
  it('the operator holds START on the pushbutton station: the vessel drains while held and refills after release', () => {
    let w = scans(start(), 1200);
    const before = level(w);
    w = tick(w, [{ k: 'setOperator', id: 'hmi', key: 'startPressed', value: 1 }]).world;
    expect(w.lastError).toBeNull();
    w = scans(w, 80);
    expect(level(w)).toBeLessThan(before - 1500);
    expect(tags(w).Drain).toBe(true);
    w = tick(w, [{ k: 'setOperator', id: 'hmi', key: 'startPressed', value: 0 }]).world;
    w = scans(w, 500);
    expect(level(w)).toBeGreaterThan(level(scans(tick(w, [{ k: 'setOperator', id: 'hmi', key: 'startPressed', value: 1 }]).world, 40)));
  });
  it('the indicator panel shows the PLC state through real lamp commands', () => {
    const w = scans(start(), 100);
    const panel = w.plantWorld.signals.panel;
    expect(panel.lit1).toBe(tags(w).Fill); expect(panel.lit2).toBe(tags(w).Heat); expect(panel.hornOn).toBe(false);
  });
});
