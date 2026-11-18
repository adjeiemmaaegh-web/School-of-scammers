import { describe, expect, it } from 'vitest';
import { compileStructuredText, executeStructuredText, type STValue } from '../src/engineering/structured-text';
import { compileSandboxST } from '../src/program/p2-contract';
import { LEGACY_NAMES } from '../src/sim/plc-io';
import { createWorld, renderSnapshot, tick } from '../src/sim/orchestrator';
import type { Command, WorldState } from '../src/sim/signals';

const program = (decl: string, body: string, extraOut = '') => compileStructuredText(
  ['VAR_INPUT', '  A : BOOL;', '  B : BOOL;', '  C : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Out : BOOL;', '  N : DINT;', extraOut, 'END_VAR', 'VAR', decl, 'END_VAR', body].join('\n'));
/** Runs scans with a fixed sequence of inputs; returns the outputs of every scan. */
const scans = (src: ReturnType<typeof program>, seq: Partial<Record<'A' | 'B' | 'C', boolean>>[]): Record<string, STValue>[] => {
  let memory: Record<string, STValue> = {};
  return seq.map(inp => { const r = executeStructuredText(src, { A: false, B: false, C: false, ...inp }, memory); memory = r.memory; return { ...r.outputs, ...r.signals }; });
};
const rep = <T,>(v: T, n: number): T[] => Array.from({ length: n }, () => v);

describe('ST timers', () => {
  it('TON: Q after PT of continuous IN (50 ms scans), reset when IN drops', () => {
    const p = program('  tm : TON;', 'tm(IN := A, PT := T#200ms);\nOut := tm.Q;\nN := tm.ET;');
    const r = scans(p, [...rep({ A: true }, 5), { A: false }, ...rep({ A: true }, 3)]);
    expect(r.map(x => x.Out)).toEqual([false, false, false, true, true, false, false, false, false]);
    expect(r.map(x => x.N)).toEqual([50, 100, 150, 200, 200, 0, 50, 100, 150]);
  });
  it('TON with PT 0 follows IN immediately; duration literals add up', () => {
    const p = program('  tm : TON;', 'tm(IN := A, PT := 0);\nOut := tm.Q;');
    expect(scans(p, [{ A: true }, { A: false }]).map(x => x.Out)).toEqual([true, false]);
    const q = program('  tm : TON;', 'tm(IN := A, PT := T#1m2s500ms);\nN := tm.ET;\nOut := A;');
    expect(scans(q, [{ A: true }])[0].N).toBe(50);
    expect(() => program('  tm : TON;', 'tm(IN := A, PT := T#99999h);\nOut := A;')).toThrow(/out of range/);
  });
  it('TOF: Q true at once, holds PT after IN falls, then drops; re-arms when IN returns', () => {
    const p = program('  tm : TOF;', 'tm(IN := A, PT := T#150ms);\nOut := tm.Q;');
    const r = scans(p, [{ A: true }, { A: false }, { A: false }, { A: false }, { A: false }, { A: true }, { A: false }]);
    expect(r.map(x => x.Out)).toEqual([true, true, true, false, false, true, true]);
  });
  it('TP: a fixed pulse regardless of IN; a new pulse needs a new rising edge', () => {
    const p = program('  tm : TP;', 'tm(IN := A, PT := T#150ms);\nOut := tm.Q;');
    const r = scans(p, [{ A: true }, { A: true }, { A: true }, { A: true }, { A: true }, { A: false }, { A: true }]);
    expect(r.map(x => x.Out)).toEqual([true, true, false, false, false, false, true]);
  });
  it('two instances keep independent state', () => {
    const p = program('  t1 : TON;\n  t2 : TON;', 't1(IN := A, PT := T#100ms);\nt2(IN := B, PT := T#200ms);\nOut := t1.Q AND NOT t2.Q;');
    const r = scans(p, [{ A: true, B: true }, { A: true, B: true }, { A: true, B: true }, { A: true, B: true }, { A: true, B: true }]);
    expect(r.map(x => x.Out)).toEqual([false, true, true, false, false]);
  });
});

describe('ST counters and edges', () => {
  it('CTU counts rising edges only, R resets, Q at PV', () => {
    const p = program('  cnt : CTU;', 'cnt(CU := A, R := B, PV := 3);\nOut := cnt.Q;\nN := cnt.CV;');
    const r = scans(p, [{ A: true }, { A: true }, { A: false }, { A: true }, { A: false }, { A: true }, { A: false }, { A: true, B: true }, { A: false }]);
    expect(r.map(x => x.N)).toEqual([1, 1, 1, 2, 2, 3, 3, 0, 0]);
    expect(r.map(x => x.Out)).toEqual([false, false, false, false, false, true, true, false, false]);
  });
  it('CTD loads PV, counts down on falling demand edges, Q at zero', () => {
    const p = program('  cnt : CTD;', 'cnt(CD := A, LD := B, PV := 2);\nOut := cnt.Q;\nN := cnt.CV;');
    const r = scans(p, [{ B: true }, { A: true }, { A: false }, { A: true }, { A: false }]);
    expect(r.map(x => x.N)).toEqual([2, 1, 1, 0, 0]);
    expect(r.map(x => x.Out)).toEqual([false, false, false, true, true]);
  });
  it('R_TRIG and F_TRIG pulse for exactly one scan', () => {
    const p = program('  r : R_TRIG;\n  f : F_TRIG;', 'r(CLK := A);\nf(CLK := A);\nOut := r.Q;', '  Fall : BOOL;');
    const seq = [{ A: false }, { A: true }, { A: true }, { A: false }, { A: false }];
    expect(scans(p, seq).map(x => x.Out)).toEqual([false, true, false, false, false]);
    const q = program('  f : F_TRIG;', 'f(CLK := A);\nOut := f.Q;');
    expect(scans(q, seq).map(x => x.Out)).toEqual([false, false, false, true, false]);
  });
});

describe('ST function block compile-time safety', () => {
  const bad = (decl: string, body: string) => () => program(decl, body);
  it('rejects unknown instances, parameters, members and instance assignment', () => {
    expect(bad('  tm : TON;', 'nope(IN := A);\nOut := A;')).toThrow(/not a declared function block/);
    expect(bad('  tm : TON;', 'tm(XX := A);\nOut := A;')).toThrow(/not an input of TON/);
    expect(bad('  tm : TON;', 'tm(IN := A, IN := B);\nOut := A;')).toThrow(/Duplicate argument/);
    expect(bad('  tm : TON;', 'tm(IN := A, PT := 1);\nOut := tm.CV;')).toThrow(/not an output of TON/);
    expect(bad('  cnt : CTU;', 'cnt(CU := A, PV := 1);\nOut := A;\ncnt := A;')).toThrow();
    expect(bad('  cnt : CTU;', 'cnt(CU := A, PV := 1);\nOut := A;\nOut := x.Q;')).toThrow(/not a function block instance/);
  });
  it('instances only in VAR, with unique names, and a non-BOOL IN is a runtime type error', () => {
    expect(() => compileStructuredText('VAR_INPUT\n  tm : TON;\nEND_VAR\nVAR_OUTPUT\n  Out : BOOL;\nEND_VAR\nOut := TRUE;')).toThrow(/VAR block/);
    expect(bad('  tm : TON;\n  tm : TOF;', 'Out := A;')).toThrow(/Duplicate/);
    expect(bad('  tm : TON;\n  tm__Q : BOOL;', 'Out := A;')).toThrow(/Duplicate/); // internal storage names cannot be shadowed
    const p = program('  tm : TON;', 'tm(IN := N, PT := 100);\nOut := tm.Q;');
    expect(() => executeStructuredText(p, { A: false, B: false, C: false }, {})).toThrow(/BOOL/);
  });
});

describe('ST function blocks in the real simulator', () => {
  const place = (id: string, kind: Extract<Command, { k: 'place' }>['kind'], x = 10, y = 10): Command => ({ k: 'place', id, kind, at: { x, y } });
  const wires = (pairs: [string, string][]): Command[] => pairs.map(([from, to], i): Command => ({ k: 'wire', id: `w${i}`, from, to }));
  const scan = (w: WorldState, n: number): WorldState => { for (let i = 0; i < n; i++) w = tick(w).world; return w; };
  it('a PLC16 Structured Text TON holds an output off for the preset, and passes the sandbox validators', () => {
    const source = ['VAR_INPUT', '  Go : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Lamp : BOOL;', 'END_VAR', 'VAR', '  tm : TON;', 'END_VAR', 'tm(IN := Go, PT := T#1s);', 'Lamp := tm.Q;'].join('\n');
    let w = tick(createWorld(), [
      place('ps', 'supply'), place('p', 'plc16', 250), place('go', 'start'), place('l', 'lamp', 600),
      ...wires([['ps.P24', 'p.L+'], ['ps.M0', 'p.M'], ['ps.P24', 'go.A'], ['go.B', 'p.I0.0'], ['p.Q0.0', 'l.L+'], ['l.M-', 'ps.M0']]),
      { k: 'configureIo', plc: 'p', io: { inputs: { 'I0.0': 'Go' }, outputs: { 'Q0.0': 'Lamp' } } },
      { k: 'loadST', source }]).world;
    expect(w.lastError).toBeNull();
    w = scan(tick(w, [{ k: 'run' }]).world, 3);
    expect(w.deviceOn.l).toBe(false);
    w = scan(tick(w, [{ k: 'operate', id: 'go', pressed: true }]).world, 10);
    expect(w.deviceOn.l).toBe(false); // 0.5 s: still timing
    w = scan(w, 14); // past 1 s plus the PLC and wiring scan lag
    expect(w.deviceOn.l).toBe(true);
    w = scan(tick(w, [{ k: 'operate', id: 'go', pressed: false }]).world, 4);
    expect(w.deviceOn.l).toBe(false);
    expect(renderSnapshot(w).plcs.p.outputs['Q0.0']).toBe(false);
  });
  it('is accepted by the classic-PLC compiler path too', () => {
    const src = ['VAR_INPUT', '  Start : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  Run : BOOL;', 'END_VAR', 'VAR', '  r : R_TRIG;', 'END_VAR', 'r(CLK := Start);', 'Run := r.Q;'].join('\n');
    expect(() => compileSandboxST(src, LEGACY_NAMES)).not.toThrow();
  });
});
