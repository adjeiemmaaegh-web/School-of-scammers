import { describe, expect, it } from 'vitest';
import { initialPneumatic, MIN_WORK_BAR, stepPneumatic, type PneumaticState } from '../src/engineering/pneumatic-cylinder';
import { airWireError, freshReceiver, solveAir, stepReceiver, type Receiver } from '../src/plant/air';
import { createWorld, renderSnapshot, tick, validateProject } from '../src/sim/orchestrator';
import type { Command, PlacedComponent, WorldState } from '../src/sim/signals';

const comp = (id: string, kind: PlacedComponent['kind']): PlacedComponent => ({ id, kind, x: 0, y: 0 } as PlacedComponent);

describe('R06 cylinder engine responds to working pressure', () => {
  const extend = (supplyBar: number | undefined, scans = 100) => {
    let s: PneumaticState = initialPneumatic(), t = 0;
    for (; t < scans; t++) {
      s = stepPneumatic(s, { command: 'extend', airOn: true, guardClosed: true, emergencyStop: false, fault: 'none', ...(supplyBar === undefined ? {} : { supplyBar }) }, 50);
      if (s.extendLimit) break;
    }
    return { s, ms: (t + 1) * 50 };
  };
  it('the original behaviour is unchanged when no supply pressure is given (6 bar, 1.2 s stroke)', () => {
    const r = extend(undefined);
    expect(r.s.extendLimit).toBe(true); expect(r.ms).toBe(1200); expect(r.s.pressureBar).toBe(6);
  });
  it('stroke time scales inversely with pressure: nominal 6 bar 1.2 s, 3 bar 2.4 s, faster above nominal, capped at 1.5x', () => {
    expect(extend(6).ms).toBe(1200);
    // 2.0 s of travel at half speed; the engine rounds position to 6 decimals each step, which can cost one extra scan.
    expect(extend(3).ms).toBeGreaterThanOrEqual(2400); expect(extend(3).ms).toBeLessThanOrEqual(2450);
    expect(extend(9).ms).toBeLessThan(1200);
    expect(extend(12).ms).toBe(extend(9).ms); // cap
  });
  it('a stroke that would take too long trips the travel-timeout alarm (pressure loss has a consequence)', () => {
    const slow = extend(2, 80);
    expect(slow.s.alarm).toBe('CYLINDER TRAVEL TIMEOUT');
    expect(extend(3).s.alarm).toBeNull();
  });
  it('below the minimum working pressure the rod does not move and the alarm says why; zero is "unavailable"', () => {
    const low = extend(MIN_WORK_BAR - 0.5, 12);
    expect(low.s.position).toBe(0); expect(low.s.alarm).toBe('LOW AIR PRESSURE');
    const none = extend(0, 12);
    expect(none.s.position).toBe(0); expect(none.s.alarm).toBe('AIR PRESSURE UNAVAILABLE');
    expect(extend(MIN_WORK_BAR, 200).s.extendLimit).toBe(true);
  });
});

describe('R06 compressor receiver', () => {
  const settings = { cutInBar: 6, cutOutBar: 8, fillBarPerS: 0.6 };
  const run = (r: Receiver, scans: number, motor = true, fault = false, leak = false, draw = 0) => {
    const trace: number[] = [];
    for (let i = 0; i < scans; i++) { r = stepReceiver(r, motor, fault, leak, draw, settings, 50); trace.push(r.pressureBar); }
    return { r, trace };
  };
  it('pumps up to cut-out, stops, and restarts when draw takes it below cut-in (hysteresis)', () => {
    const up = run(freshReceiver(), 320);
    expect(up.r.pressureBar).toBeGreaterThanOrEqual(8); expect(up.r.pumping).toBe(false);
    expect(Math.max(...up.trace)).toBeLessThanOrEqual(8.4);
    const bled = run(up.r, 60, true, false, false, 1.0);          // heavy draw: falls below cut-in
    expect(bled.trace.some(p => p < 6)).toBe(true);
    const back = run(bled.r, 40, true);
    expect(back.r.pumping || back.r.pressureBar > bled.r.pressureBar).toBe(true);
  });
  it('does not pump with the motor off or the pump fault, and a leak bleeds the receiver', () => {
    expect(run(freshReceiver(), 40, false).r.pressureBar).toBe(0);
    expect(run(freshReceiver(), 40, true, true).r.pressureBar).toBe(0);
    const leaking = run({ pressureBar: 6, pumping: false }, 20, false, false, true);
    expect(leaking.r.pressureBar).toBeLessThan(6 - 0.3);
    expect(run({ pressureBar: 0.1, pumping: false }, 30, false, false, true).r.pressureBar).toBe(0); // never negative
  });
  it('a leak larger than the pump rate stops it ever reaching pressure', () => {
    const r = run(freshReceiver(), 400, true, false, true);   // fill 0.6 vs leak 0.4 net +0.2: slowly rises
    const weak = { cutInBar: 6, cutOutBar: 8, fillBarPerS: 0.3 };
    let x = freshReceiver();
    for (let i = 0; i < 400; i++) x = stepReceiver(x, true, false, true, 0, weak, 50);
    expect(x.pressureBar).toBe(0);
    expect(r.r.pressureBar).toBeGreaterThan(0);
  });
});

describe('R06 air lines and regulators', () => {
  const parts = [comp('c1', 'compressor'), comp('c2', 'compressor'), comp('r1', 'air-regulator'), comp('r2', 'air-regulator'), comp('y1', 'cylinder'), comp('y2', 'cylinder')];
  const w = (from: string, to: string, id = from + to) => ({ id, from, to });
  const tank = (bar: number): Receiver => ({ pressureBar: bar, pumping: false });
  it('carries receiver pressure through a line to a cylinder, and an unconnected port gets nothing', () => {
    const s = solveAir(parts, [w('c1.AIR', 'y1.AIR')], { c1: tank(7) }, {});
    expect(s.pressureAt('y1.AIR')).toBe(7); expect(s.pressureAt('y2.AIR')).toBe(0); expect(s.suppliersOf('y1.AIR')).toEqual(['c1']);
    expect(s.pressureAt('nope.AIR')).toBe(0);
  });
  it('a regulator limits its outlet to its set point, never raises pressure, and is one-way', () => {
    const lines = [w('c1.AIR', 'r1.AIR_IN'), w('r1.AIR_OUT', 'y1.AIR')];
    expect(solveAir(parts, lines, { c1: tank(8) }, { r1: 4 }).pressureAt('y1.AIR')).toBe(4);
    expect(solveAir(parts, lines, { c1: tank(3) }, { r1: 4 }).pressureAt('y1.AIR')).toBe(3);
    // outlet side fed by a compressor does NOT back-feed the inlet side
    const back = solveAir(parts, [w('c2.AIR', 'r1.AIR_OUT'), w('r1.AIR_IN', 'y2.AIR')], { c2: tank(7) }, { r1: 4 });
    expect(back.pressureAt('y2.AIR')).toBe(0);
  });
  it('regulators in series take the lower limit; two compressors on one line give the higher pressure and share the draw', () => {
    const chain = [w('c1.AIR', 'r1.AIR_IN'), w('r1.AIR_OUT', 'r2.AIR_IN'), w('r2.AIR_OUT', 'y1.AIR')];
    expect(solveAir(parts, chain, { c1: tank(8) }, { r1: 5, r2: 3 }).pressureAt('y1.AIR')).toBe(3);
    expect(solveAir(parts, chain, { c1: tank(8) }, { r1: 2, r2: 6 }).pressureAt('y1.AIR')).toBe(2);
    const both = solveAir(parts, [w('c1.AIR', 'y1.AIR'), w('c2.AIR', 'y1.AIR')], { c1: tank(6), c2: tank(6) }, {});
    expect(both.pressureAt('y1.AIR')).toBe(6); expect(both.suppliersOf('y1.AIR')).toEqual(['c1', 'c2']);
    const higher = solveAir(parts, [w('c1.AIR', 'y1.AIR'), w('c2.AIR', 'y1.AIR')], { c1: tank(6), c2: tank(7) }, {});
    expect(higher.pressureAt('y1.AIR')).toBe(7); expect(higher.suppliersOf('y1.AIR')).toEqual(['c2']);
  });
  it('an air line joins air ports only', () => {
    expect(airWireError('c1.AIR', 'y1.AIR', parts)).toBeNull();
    expect(airWireError('c1.AIR', 'y1.EXT+', parts)).toMatch(/air ports only/);
    expect(airWireError('y1.EXT+', 'y1.M-', parts)).toBeNull();
  });
});

describe('R06 end to end through the real engine: compressor -> regulator -> cylinder, driven by buttons', () => {
  const P = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x: number): Command => ({ k: 'place', id, kind, at: { x, y: 10 } });
  const W = (id: string, from: string, to: string): Command => ({ k: 'wire', id, from, to });
  function cell(opts: { regulator?: number; air?: 'full' | 'none' | 'noRegulator'; fill?: number } = {}): WorldState {
    const cmds: Command[] = [P('ps', 'supply', 10), P('pump', 'start', 90), P('ext', 'start', 170), P('comp', 'compressor', 250), P('reg', 'air-regulator', 330), P('cyl', 'cylinder', 410), P('lamp', 'lamp', 490),
      W('a', 'ps.P24', 'pump.A'), W('b', 'pump.B', 'comp.A1'), W('c', 'comp.A2', 'ps.M0'),
      W('d', 'ps.P24', 'ext.A'), W('e', 'ext.B', 'cyl.EXT+'), W('f', 'cyl.M-', 'ps.M0'),
      W('g', 'ps.P24', 'comp.PS_A'), W('h', 'comp.PS_B', 'lamp.L+'), W('i', 'lamp.M-', 'ps.M0')];
    if (opts.air !== 'none') cmds.push(...(opts.air === 'noRegulator'
      ? [W('air1', 'comp.AIR', 'cyl.AIR')] : [W('air1', 'comp.AIR', 'reg.AIR_IN'), W('air2', 'reg.AIR_OUT', 'cyl.AIR')]));
    if (opts.regulator !== undefined) cmds.push({ k: 'setParam', id: 'reg', key: 'setpointBar', value: opts.regulator });
    if (opts.fill !== undefined) cmds.push({ k: 'setParam', id: 'comp', key: 'fillBarPerS', value: opts.fill });
    const w = tick(createWorld(), cmds).world;
    expect(w.lastError).toBeNull();
    return tick(w, [{ k: 'run' }]).world;
  }
  const scans = (w: WorldState, n: number) => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
  const cyl = (w: WorldState) => renderSnapshot(w).cylinders.cyl;
  /** Pump on until receiver >= bar, then extend; returns the scans the stroke took (or -1) */
  const stroke = (w: WorldState, maxScans = 400) => {
    w = tick(w, [{ k: 'operate', id: 'pump', pressed: true }]).world;
    for (let i = 0; i < 500 && (renderSnapshot(w).air?.receivers.comp.pressureBar ?? 0) < 6; i++) w = tick(w).world;
    w = tick(w, [{ k: 'operate', id: 'ext', pressed: true }]).world;
    let n = 0;
    while (n < maxScans && !cyl(w).extendLimit && !cyl(w).alarm) { w = tick(w).world; n++; }
    return { w, n: cyl(w).extendLimit ? n : -1 };
  };

  it('without a compressor the project behaves exactly as before: air is available and the snapshot has no air section', () => {
    const w = tick(createWorld(), [P('ps', 'supply', 10), P('ext', 'start', 90), P('cyl', 'cylinder', 170),
      W('d', 'ps.P24', 'ext.A'), W('e', 'ext.B', 'cyl.EXT+'), W('f', 'cyl.M-', 'ps.M0')]).world;
    let r = tick(w, [{ k: 'run' }, { k: 'operate', id: 'ext', pressed: true }]).world;
    r = scans(r, 40);
    expect(cyl(r).extendLimit).toBe(true);
    expect(renderSnapshot(r).air).toBeUndefined();
  });
  it('a compressor that is off leaves the cylinder without air: no motion and an alarm', () => {
    let w = cell();
    w = scans(tick(w, [{ k: 'operate', id: 'ext', pressed: true }]).world, 30);
    expect(cyl(w).position).toBe(0); expect(cyl(w).alarm).toBe('AIR PRESSURE UNAVAILABLE');
    expect(renderSnapshot(w).air?.receivers.comp.pressureBar).toBe(0);
  });
  it('running the pump builds pressure, the regulator limits what the cylinder sees, and the cylinder then extends', () => {
    const { w, n } = stroke(cell({ regulator: 4 }));
    expect(n).toBeGreaterThan(0);
    expect(renderSnapshot(w).air?.working.reg).toBe(4);
    expect(renderSnapshot(w).air?.working.cyl).toBe(4);
    // 4 bar vs nominal 6: the stroke takes 1.5x as long as the 24-scan nominal stroke
    expect(n * 50).toBeGreaterThan(1500);
  });
  it('a lower regulator setting makes the stroke slower, a very low one trips the timeout, and below minimum it will not move', () => {
    const base = stroke(cell({ regulator: 6 })).n, mid = stroke(cell({ regulator: 3 })).n;
    expect(mid).toBeGreaterThan(base);
    const slow = stroke(cell({ regulator: 2 }));
    expect(slow.n).toBe(-1); expect(cyl(slow.w).alarm).toBe('CYLINDER TRAVEL TIMEOUT');
    const low = stroke(cell({ regulator: 1 }));
    expect(low.n).toBe(-1); expect(cyl(low.w).position).toBe(0); expect(cyl(low.w).alarm).toBe('LOW AIR PRESSURE');
  });
  it('a miswired air line (cylinder not plumbed) never gets air even with a full receiver', () => {
    const { w, n } = stroke(cell({ air: 'none' }));
    expect(n).toBe(-1); expect(cyl(w).position).toBe(0);
    expect(renderSnapshot(w).air?.working.cyl).toBe(0);
  });
  it('an air leak that outruns the pump keeps the system dead; clearing the fault restores service', () => {
    let w = cell({ fill: 0.3 });
    w = tick(w, [{ k: 'injectFault', kind: 'air-leak', target: 'comp', hidden: false }]).world;
    w = tick(w, [{ k: 'operate', id: 'pump', pressed: true }]).world;
    w = scans(w, 200);
    expect(renderSnapshot(w).air?.receivers.comp.pressureBar).toBe(0);
    w = tick(w, [{ k: 'clearFault', id: w.project.faults![0].id }]).world;
    w = scans(w, 420);   // 0.3 bar/s for 21 s of pumping is about 6 bar
    expect(renderSnapshot(w).air?.receivers.comp.pressureBar).toBeGreaterThan(5);
  });
  it('a failed pump motor cannot build pressure', () => {
    let w = cell();
    w = tick(w, [{ k: 'injectFault', kind: 'compressor-motor-fault', target: 'comp', hidden: false }]).world;
    w = scans(tick(w, [{ k: 'operate', id: 'pump', pressed: true }]).world, 200);
    expect(renderSnapshot(w).air?.receivers.comp.pressureBar).toBe(0);
  });
  it('each stroke drains the receiver: with the pump stopped, pressure falls while the cylinder moves', () => {
    let w = tick(cell({ regulator: 6 }), [{ k: 'operate', id: 'pump', pressed: true }]).world;
    w = scans(w, 260);
    w = tick(w, [{ k: 'operate', id: 'pump', pressed: false }]).world;
    const before = renderSnapshot(w).air!.receivers.comp.pressureBar;
    w = scans(tick(w, [{ k: 'operate', id: 'ext', pressed: true }]).world, 30);
    expect(renderSnapshot(w).air!.receivers.comp.pressureBar).toBeLessThan(before);
    expect(cyl(w).extendLimit).toBe(true);
  });
  it('the pressure-switch contact closes at its set pressure and feeds a lamp (a PLC could read it)', () => {
    let w = cell();
    expect(renderSnapshot(w).deviceOn.lamp).toBe(false);
    w = tick(w, [{ k: 'operate', id: 'pump', pressed: true }]).world;
    let lit = -1;
    for (let i = 0; i < 400 && lit < 0; i++) { w = tick(w).world; if (renderSnapshot(w).deviceOn.lamp) lit = i; }
    expect(lit).toBeGreaterThan(0);
    expect(renderSnapshot(w).air!.receivers.comp.pressureBar).toBeGreaterThanOrEqual(5);
  });
  it('an air line cannot be wired to an electrical terminal, and a compressor project saves and reloads', () => {
    const w = cell();
    const bad = tick(w, [{ k: 'pause' }, W('x', 'comp.AIR', 'ps.P24')]).world;
    expect(bad.lastError).toMatch(/air ports only/);
    const reloaded = validateProject(JSON.parse(JSON.stringify(w.project)));
    expect(reloaded.components.some(c => c.kind === 'compressor')).toBe(true);
    expect(reloaded.wires.some(x => x.id === 'air1')).toBe(true);
    expect(() => validateProject({ ...JSON.parse(JSON.stringify(w.project)), wires: [...w.project.wires, { id: 'zz', from: 'comp.AIR', to: 'lamp.L+' }] })).toThrow(/air ports only/);
  });
});

describe('device settings accept decimal steps (validator fix found while building R06)', () => {
  it('0.1-step settings such as 0.3 bar/s are valid, and genuinely off-step values are still refused', async () => {
    const { paramError, paramSpecsOf } = await import('../src/components/params');
    const fill = paramSpecsOf('compressor')[2];
    for (const v of [0.1, 0.3, 0.6, 0.7, 1.9, 2]) expect(paramError(fill, v), String(v)).toBeNull();
    expect(paramError(fill, 0.35)).toMatch(/multiple of 0.1/);
    expect(paramError(fill, 2.1)).toMatch(/between/);
    const sp = paramSpecsOf('air-regulator')[0];
    expect(paramError(sp, 4.5)).toBeNull(); expect(paramError(sp, 4.4)).toMatch(/multiple of 0.5/);
  });
});
