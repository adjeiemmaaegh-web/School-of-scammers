import { describe, expect, it } from 'vitest';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import { pneumaticCellDemo } from '../src/plant/demos/pneumatic-cell';
import type { Command, WorldState } from '../src/sim/signals';

const start = (cylinder: Record<string, number> = {}, regulator = 6, extra: Command[] = [], pump = 0.6): WorldState => {
  let w = tick(createWorld(), [{ k: 'loadProject', project: pneumaticCellDemo(cylinder, regulator, pump) }, ...extra]).world;
  expect(w.lastError).toBeNull();
  w = tick(w, [{ k: 'run' }]).world;
  return w;
};
const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
const cycles = (w: WorldState) => renderSnapshot(w).plcs.plc.tagValues.Cycles as number;
const cyl = (w: WorldState) => renderSnapshot(w).cylinders.cyl;

describe('Demonstration C: pneumatic production cell (compressor, regulator, cylinder, PLC)', () => {
  it('builds pressure, then the PLC cycles the cylinder extend -> dwell -> retract and counts cycles', () => {
    let w = start();
    w = scans(w, 600);                                               // 30 s
    expect(cycles(w)).toBeGreaterThanOrEqual(4);
    expect(cyl(w).alarm).toBeNull();
    const pressure = renderSnapshot(w).air!.receivers.comp.pressureBar;
    expect(pressure).toBeGreaterThan(3); expect(pressure).toBeLessThanOrEqual(8);
  });
  it('nothing moves until the receiver has pressure (the PLC waits on the pressure switch)', () => {
    let w = start();
    w = scans(w, 3);
    expect(cycles(w)).toBe(0); expect(cyl(w).position).toBe(0);
  });
  it('a compressed-air leak starves the cell: cycling stops and the cylinder alarms; clearing the leak restores production', () => {
    let w = start({}, 6, [], 0.3);
    w = scans(w, 1200);
    const running = cycles(w);
    expect(running).toBeGreaterThanOrEqual(1);
    w = tick(w, [{ k: 'pause' }, { k: 'injectFault', kind: 'air-leak', target: 'comp', hidden: false }, { k: 'run' }]).world;
    expect(w.lastError).toBeNull();
    w = scans(w, 600);
    const during = cycles(w);
    w = scans(w, 600);
    expect(cycles(w)).toBe(during);                                  // stalled
    const fault = (w.project.faults ?? []).find(f => f.kind === 'air-leak');
    expect(fault).toBeTruthy();
    w = tick(w, [{ k: 'pause' }, { k: 'clearFault', id: fault!.id }, { k: 'run' }]).world;
    w = scans(w, 1800);
    expect(cycles(w)).toBeGreaterThan(during);
  });
  it('a low regulator setting slows every stroke: fewer cycles in the same time than at 6 bar', () => {
    const fast = cycles(scans(start({}, 6), 700)), slow = cycles(scans(start({}, 3), 700));
    expect(slow).toBeLessThan(fast);
    expect(slow).toBeGreaterThan(0);
  });
  it('a flow-control restrictor on the extend stroke also costs cycles', () => {
    const base = cycles(scans(start({ boreMm: 40, loadKg: 1 }), 700)), restricted = cycles(scans(start({ boreMm: 40, loadKg: 1, extendFlowPct: 30 }), 700));
    expect(restricted).toBeLessThan(base);
  });
  it('a load beyond the cylinder force stalls the cell with an OVERLOAD alarm, and a bigger bore cures it', () => {
    const stalled = scans(start({ boreMm: 40, loadKg: 100, vertical: 1 }), 500);
    expect(cycles(stalled)).toBe(0); expect(cyl(stalled).alarm).toMatch(/OVERLOAD/);
    expect(cycles(scans(start({ boreMm: 64, loadKg: 100, vertical: 1 }), 500))).toBeGreaterThan(0);
  });
});
