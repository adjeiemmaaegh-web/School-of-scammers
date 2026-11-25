import { describe, expect, it } from 'vitest';
import { DEFAULT_PNEUMATIC_INPUT, initialPneumatic, stepPneumatic } from '../src/engineering/pneumatic-cylinder';
import type { PneumaticInput, PneumaticState } from '../src/engineering/pneumatic-cylinder';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';
import { cylinderForceN, pistonAreas } from '../src/engineering/pneumatic-circuit';
import type { PneumaticCircuit } from '../src/engineering/pneumatic-circuit';

type Cmd = PneumaticInput['command'];
const drive = (circuit: PneumaticCircuit | undefined, command: Cmd, scans: number, over: Partial<PneumaticInput> = {}, from: PneumaticState = initialPneumatic()) => {
  let s = from;
  for (let i = 0; i < scans; i++) s = stepPneumatic(s, { ...DEFAULT_PNEUMATIC_INPUT, command, supplyBar: 6, ...(circuit ? { circuit } : {}), ...over }, 50);
  return s;
};
const extendedAt = (circuit: PneumaticCircuit | undefined, over: Partial<PneumaticInput> = {}, max = 400): number => {
  let s = initialPneumatic();
  for (let i = 1; i <= max; i++) {
    s = stepPneumatic({ ...s, alarm: null, travelMs: 0 }, { ...DEFAULT_PNEUMATIC_INPUT, command: 'extend', supplyBar: 6, ...(circuit ? { circuit } : {}), ...over }, 50);
    if (s.extendLimit) return i * 50;
  }
  return Infinity;
};
const half = (circuit: PneumaticCircuit, command: Cmd = 'extend', from?: PneumaticState) => drive(circuit, command, 4, {}, from);

describe('R06 piston force', () => {
  it('force is pressure times area: full bore pushes harder than the annulus pulls, and it scales with pressure and bore', () => {
    const a = pistonAreas(40);
    expect(a.cap).toBeCloseTo(Math.PI * 0.02 * 0.02, 9);
    expect(a.annulus).toBeLessThan(a.cap);
    expect(cylinderForceN(40, 6, true)).toBeCloseTo(6e5 * a.cap * 0.9, 6);
    expect(cylinderForceN(40, 6, false)).toBeLessThan(cylinderForceN(40, 6, true));
    expect(cylinderForceN(40, 3, true)).toBeCloseTo(cylinderForceN(40, 6, true) / 2, 6);
    expect(cylinderForceN(63, 6, true)).toBeGreaterThan(2 * cylinderForceN(40, 6, true));
  });
  it('without a circuit nothing changes: same trace as the legacy engine, no readout', () => {
    const legacy = drive(undefined, 'extend', 30);
    expect(legacy.circuit).toBeUndefined();
    expect(extendedAt(undefined)).toBe(1200);
  });
});

describe('R06 load-dependent movement and overload', () => {
  const lift = (loadKg: number, extra: PneumaticCircuit = {}) => ({ loadKg, vertical: true, boreMm: 40, ...extra });
  it('a load within the cylinder force lifts, slower the heavier it is', () => {
    const light = extendedAt(lift(5)), heavy = extendedAt(lift(40));
    expect(light).toBeLessThan(Infinity); expect(heavy).toBeLessThan(Infinity);
    expect(heavy).toBeGreaterThan(light);
  });
  it('a load beyond the force stalls the rod and raises an overload alarm; a bigger bore lifts it', () => {
    const s = drive(lift(100), 'extend', 30);                      // 981 N against about 680 N
    expect(s.position).toBe(0);
    expect(s.alarm).toMatch(/OVERLOAD/);
    expect(extendedAt(lift(100, { boreMm: 63 }))).toBeLessThan(Infinity);
  });
  it('lower supply pressure fails a load that 6 bar lifts', () => {
    expect(extendedAt(lift(50))).toBeLessThan(Infinity);
    expect(extendedAt(lift(50), { supplyBar: 3 })).toBe(Infinity);
  });
  it('the readout reports the force and the load', () => {
    const s = drive(lift(20), 'extend', 4);
    expect(s.circuit!.loadN).toBeCloseTo(196.2, 1);
    expect(s.circuit!.forceN).toBeCloseTo(cylinderForceN(40, 6, true), 0);
  });
  it('a horizontal load only has to overcome friction, so a heavy one still slides', () => {
    expect(extendedAt({ loadKg: 100, vertical: false, boreMm: 40 })).toBeLessThan(Infinity);
  });
});

describe('R06 flow control, line loss and leakage', () => {
  it('a restrictor slows its own direction only', () => {
    const open = extendedAt({}), half = extendedAt({ extendRestrictor: 0.5 });
    expect(Math.abs(half - open * 2)).toBeLessThanOrEqual(100);
    const retract = (c: PneumaticCircuit) => { let s = drive({}, 'extend', 40); let t = 0; while (!s.retractLimit && t < 400) { s = stepPneumatic({ ...s, alarm: null }, { ...DEFAULT_PNEUMATIC_INPUT, command: 'retract', supplyBar: 6, circuit: c }, 50); t++; } return t; };
    expect(retract({ extendRestrictor: 0.3 })).toBe(retract({}));
    expect(retract({ retractRestrictor: 0.5 })).toBeGreaterThan(retract({}));
  });
  it('line loss reduces the port pressure and the speed; enough loss stops motion', () => {
    const lossy = extendedAt({ lineLossBar: 2 });
    expect(lossy).toBeGreaterThan(extendedAt({}));
    expect(drive({ lineLossBar: 2 }, 'extend', 2).circuit!.portBar).toBeCloseTo(4, 6);
    expect(extendedAt({ lineLossBar: 5 })).toBe(Infinity);
  });
  it('a leaking closed-centre circuit cannot hold a vertical load; a sound one can', () => {
    const raised = drive({ loadKg: 10, vertical: true }, 'extend', 8);
    const held = (leak: number) => drive({ loadKg: 10, vertical: true, leakage: leak }, 'neutral', 40, {}, raised).position;
    expect(held(0)).toBeCloseTo(raised.position, 9);
    expect(held(0.5)).toBeLessThan(raised.position - 0.1);
  });
});

describe('R06 valve types', () => {
  it('single-acting: the extend coil pushes out and the spring returns it, even with no air; the retract coil does nothing', () => {
    const single: PneumaticCircuit = { actuation: 'single' };
    const out = drive(single, 'extend', 30);
    expect(out.extendLimit).toBe(true);
    const back = drive(single, 'neutral', 40, { fault: 'no-air' }, out);
    expect(back.retractLimit).toBe(true);
    expect(drive(single, 'retract', 20, {}, out).position).toBeLessThan(1);   // spring return, not the (absent) retract port
  });
  it('single-acting spring cannot lift a heavy vertical load by itself against it... but extend still needs force', () => {
    expect(extendedAt({ actuation: 'single', loadKg: 100, vertical: true })).toBe(Infinity);
    expect(extendedAt({ actuation: 'single', loadKg: 5, vertical: true })).toBeLessThan(Infinity);
  });
  it('5/3 closed centre holds position when both coils are off', () => {
    const mid = half({ centre: 'closed' });
    expect(drive({ centre: 'closed' }, 'neutral', 20, {}, mid).position).toBeCloseTo(mid.position, 9);
  });
  it('5/3 exhaust centre: a vertical load drops the rod; a horizontal one stays put', () => {
    const raised = drive({ loadKg: 5, vertical: true, centre: 'exhaust' }, 'extend', 10);
    expect(drive({ loadKg: 5, vertical: true, centre: 'exhaust' }, 'neutral', 10, {}, raised).position).toBeLessThan(raised.position);
    expect(drive({ loadKg: 5, vertical: false, centre: 'exhaust' }, 'neutral', 10, {}, raised).position).toBeCloseTo(raised.position, 9);
  });
  it('5/3 pressure centre: both ports pressurised, the larger piston area pushes the rod out (slowly)', () => {
    const s = drive({ centre: 'pressure' }, 'neutral', 10);
    expect(s.position).toBeGreaterThan(0);
    let t = 0, st = initialPneumatic();
    while (!st.extendLimit && t < 2000) { st = stepPneumatic(st, { ...DEFAULT_PNEUMATIC_INPUT, command: 'neutral', supplyBar: 6, circuit: { centre: 'pressure' } }, 50); t++; }
    expect(t * 50).toBeGreaterThan(2 * extendedAt({}));            // much slower than driving it out under full force
  });
  it('double-acting retract uses the smaller annulus: a load lifted on the way out can still stall on the way back horizontally with enough friction', () => {
    const c = { loadKg: 100, vertical: false, boreMm: 40 };
    const out = drive(c, 'extend', 60);
    expect(out.extendLimit).toBe(true);
    expect(drive(c, 'retract', 60, {}, out).retractLimit).toBe(true);
  });
  it('a jammed rod does not move under any circuit', () => {
    expect(drive({ actuation: 'single' }, 'extend', 20, { fault: 'rod-jammed' }).position).toBe(0);
  });
});

describe('R06 end to end through the real engine: compressor -> cylinder with circuit settings from the device inspector', () => {
  const P = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], at: number): Command => ({ k: 'place', id, kind, at: { x: at, y: 10 } });
  const W = (id: string, from: string, to: string): Command => ({ k: 'wire', id, from, to });
  const cell = (settings: Record<string, number>): WorldState => {
    const cmds: Command[] = [P('ps', 'supply', 10), P('pump', 'start', 90), P('ext', 'start', 170), P('ret', 'start', 215), P('comp', 'compressor', 250), P('cyl', 'cylinder', 410),
      W('a', 'ps.P24', 'pump.A'), W('b', 'pump.B', 'comp.A1'), W('c', 'comp.A2', 'ps.M0'),
      W('d', 'ps.P24', 'ext.A'), W('e', 'ext.B', 'cyl.EXT+'), W('r1', 'ps.P24', 'ret.A'), W('r2', 'ret.B', 'cyl.RET+'), W('f', 'cyl.M-', 'ps.M0'),
      W('air1', 'comp.AIR', 'cyl.AIR'),
      ...Object.entries(settings).map(([key, value]): Command => ({ k: 'setParam', id: 'cyl', key, value }))];
    const w = tick(createWorld(), cmds).world;
    expect(w.lastError).toBeNull();
    return tick(w, [{ k: 'run' }, { k: 'operate', id: 'pump', pressed: true }]).world;
  };
  const cyl = (w: WorldState) => renderSnapshot(w).cylinders.cyl;
  const stroke = (settings: Record<string, number>, press = 'ext') => {
    let w = cell(settings);
    for (let i = 0; i < 500 && (renderSnapshot(w).air?.receivers.comp.pressureBar ?? 0) < 6; i++) w = tick(w).world;
    w = tick(w, [{ k: 'operate', id: press, pressed: true }]).world;
    let n = 0;
    while (n < 300 && !cyl(w).extendLimit && !cyl(w).alarm) { w = tick(w).world; n++; }
    return { n, c: cyl(w) };
  };
  it('default settings keep the original cylinder: no readout, same stroke time as before', () => {
    const r = stroke({});
    expect(r.c.circuit).toBeUndefined(); expect(r.c.extendLimit).toBe(true);
  });
  it('a load the cylinder can lift: the stroke is slower and the force and load are reported', () => {
    const base = stroke({}).n, loaded = stroke({ loadKg: 40, vertical: 1 });
    expect(loaded.c.extendLimit).toBe(true);
    expect(loaded.n).toBeGreaterThan(base);
    expect(loaded.c.circuit!.loadN).toBeCloseTo(392.4, 1);
  });
  it('an overloaded cylinder stalls with an overload alarm, and a bigger bore fixes it', () => {
    const bad = stroke({ loadKg: 100, vertical: 1 });
    expect(bad.c.extendLimit).toBe(false); expect(bad.c.alarm).toMatch(/OVERLOAD/);
    expect(stroke({ loadKg: 100, vertical: 1, boreMm: 64 }).c.extendLimit).toBe(true);
  });
  it('flow control and line loss slow the stroke through the real tick', () => {
    const base = stroke({ boreMm: 40, loadKg: 1 }).n;
    expect(stroke({ boreMm: 40, loadKg: 1, extendFlowPct: 50 }).n).toBeGreaterThan(base * 1.6);
    expect(stroke({ boreMm: 40, loadKg: 1, lineLossBar: 2 }).n).toBeGreaterThan(base);
  });
  it('a single-acting cylinder with the extend button released springs back by itself', () => {
    let w = cell({ actuation: 1 });
    for (let i = 0; i < 500 && (renderSnapshot(w).air?.receivers.comp.pressureBar ?? 0) < 6; i++) w = tick(w).world;
    w = tick(w, [{ k: 'operate', id: 'ext', pressed: true }]).world;
    for (let i = 0; i < 60; i++) w = tick(w).world;
    expect(cyl(w).extendLimit).toBe(true);
    w = tick(w, [{ k: 'operate', id: 'ext', pressed: false }]).world;
    for (let i = 0; i < 80; i++) w = tick(w).world;
    expect(cyl(w).retractLimit).toBe(true);
  });
});
