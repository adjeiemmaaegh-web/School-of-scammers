import { describe, expect, it } from 'vitest';
import { DemoBuilder } from '../src/plant/demos/builder';
import { createWorld, tick } from '../src/sim/orchestrator';
import { compileIlToSt, extractIl, validateIl } from '../src/engineering/il';
import { namesOf, defaultIo } from '../src/sim/plc-io';
import type { SfcDocument } from '../src/engineering/sfc';
import type { Command, WorldState } from '../src/sim/signals';

const NAMES = namesOf(defaultIo('plc16'));
/** PLC16 with two pushbuttons: `b0` on In0 and `b1` on In1 (a button pressed = its input high). */
const base = (): WorldState => {
  const b = new DemoBuilder();
  b.place('b0', 'start', -300, 200).place('b1', 'start', -200, 200);
  b.wire('ps.P24', 'b0.A'); b.wire('b0.B', 'plc.I0.0'); b.wire('ps.P24', 'b1.A'); b.wire('b1.B', 'plc.I0.1');
  const w = tick(createWorld(), [{ k: 'loadProject', project: b.build('VAR_INPUT In0 : BOOL; END_VAR VAR_OUTPUT Out0 : BOOL; END_VAR Out0 := FALSE;') }]).world;
  expect(w.lastError).toBeNull();
  return w;
};
const force = (tag: string, value: boolean): Command => ({ k: 'operate', id: tag === 'In0' ? 'b0' : 'b1', pressed: value });
const out = (w: WorldState, tag: string) => w.plcs.plc!.tagValues[tag];
/** Run one scan per stimulus step with the inputs forced; return the traced output tags. */
function trace(w: WorldState, steps: Array<Record<string, boolean>>, watch: string[]): boolean[][] {
  const rows: boolean[][] = [];
  w = tick(w, [{ k: 'run' }]).world;
  for (const step of steps) {
    w = tick(w, Object.entries(step).map(([t, v]) => force(t, v))).world;
    expect(w.lastError).toBeNull();
    rows.push(watch.map(t => out(w, t) === true));
  }
  return rows;
}
const T = true, F = false;

describe('R07 Instruction List', () => {
  const runIl = (il: string, steps: Array<Record<string, boolean>>, watch: string[]) => {
    const w = tick(base(), [{ k: 'loadIL', source: il }]).world;
    expect(w.lastError).toBeNull();
    return trace(w, steps, watch);
  };
  it('LD/ST copy and LDN/STN invert', () => {
    expect(runIl('LD In0\nST Out0\nLDN In0\nST Out1', [{ In0: T }, { In0: F }], ['Out0', 'Out1'])).toEqual([[T, F], [F, T]]);
    expect(runIl('LD In0\nSTN Out0', [{ In0: T }, { In0: F }], ['Out0'])).toEqual([[F], [T]]);
  });
  it('AND, OR and XOR (and their N forms) combine the accumulator with the operand: full truth tables', () => {
    const table = (op: string) => runIl(`LD In0\n${op} In1\nST Out0`, [{ In0: F, In1: F }, { In0: F, In1: T }, { In0: T, In1: F }, { In0: T, In1: T }], ['Out0']).map(r => r[0]);
    expect(table('AND')).toEqual([F, F, F, T]);
    expect(table('ANDN')).toEqual([F, F, T, F]);
    expect(table('OR')).toEqual([F, T, T, T]);
    expect(table('ORN')).toEqual([T, F, T, T]);
    expect(table('XOR')).toEqual([F, T, T, F]);
    expect(table('XORN')).toEqual([T, F, F, T]);
  });
  it('NOT inverts the accumulator, and TRUE/FALSE are constants', () => {
    expect(runIl('LD In0\nNOT\nST Out0', [{ In0: T }, { In0: F }], ['Out0'])).toEqual([[F], [T]]);
    expect(runIl('LD TRUE\nAND In0\nST Out0\nLD FALSE\nOR In0\nST Out1', [{ In0: T }, { In0: F }], ['Out0', 'Out1'])).toEqual([[T, T], [F, F]]);
  });
  it('S sets and R resets only while the accumulator is TRUE, and the output keeps its value between scans', () => {
    const prog = 'LD In0\nS Out0\nLD In1\nR Out0';
    expect(runIl(prog, [{ In0: T, In1: F }, { In0: F, In1: F }, { In0: F, In1: F }, { In0: F, In1: T }, { In0: F, In1: F }], ['Out0']).map(r => r[0])).toEqual([T, T, T, F, F]);
  });
  it('an output can be read back and an unknown name is a private memory bit that persists', () => {
    const latch = runIl('LD In0\nOR Out0\nANDN In1\nST Out0', [{ In0: T, In1: F }, { In0: F, In1: F }, { In0: F, In1: T }, { In0: F, In1: F }], ['Out0']).map(r => r[0]);
    expect(latch).toEqual([T, T, F, F]);
    const mem = runIl('LD In0\nS Seal\nLD Seal\nST Out0', [{ In0: T }, { In0: F }, { In0: F }], ['Out0']).map(r => r[0]);
    expect(mem).toEqual([T, T, T]);
  });
  it('comments and blank lines are ignored; case does not matter for instructions or tag names', () => {
    expect(runIl('(* seal-in *)\n\nld in0   // start\nst OUT0', [{ In0: T }, { In0: F }], ['Out0']).map(r => r[0])).toEqual([T, F]);
  });
  it('refuses bad programs with line numbers, and leaves the running program alone', () => {
    const bad = (s: string) => validateIl(s, NAMES).join('; ');
    expect(bad('')).toMatch(/empty/);
    expect(bad('AND In0')).toMatch(/starts with LD/);
    expect(bad('LD In0\nFOO In1')).toMatch(/Line 2: unknown instruction FOO/);
    expect(bad('LD In0\nST')).toMatch(/Line 2: ST needs exactly one operand/);
    expect(bad('LD In0\nNOT In1')).toMatch(/NOT takes no operand/);
    expect(bad('LD In0\nST In1')).toMatch(/Line 2: In1 is an input and cannot be written/);
    expect(bad('LD In0\nST TRUE')).toMatch(/cannot be written/);
    expect(bad('LD In0\nJMP end')).toMatch(/not supported/);
    expect(bad('start: LD In0')).toMatch(/not supported/);
    expect(bad('LD Analog0')).toMatch(/numeric/);
    expect(bad('LD 9bad')).toMatch(/not a valid operand/);
    expect(bad(Array.from({ length: 401 }, () => 'LD In0').join('\n'))).toMatch(/At most 400/);
    const w = tick(base(), [{ k: 'loadIL', source: 'LD In0\nST In1' }]).world;
    expect(w.lastError).toMatch(/^IL: /);
    expect(w.project.stSource).toContain('Out0 := FALSE');
    expect(tick(base(), [{ k: 'loadIL', source: 'LD In0\nST Out0', plc: 'ghost' }]).world.lastError).toMatch(/Unknown PLC/);
  });
  it('round-trips: the IL text is recovered from the generated source', () => {
    const il = 'LD In0\nOR Out0\nANDN In1\nST Out0 (* the latch *)';
    expect(extractIl(compileIlToSt(il, NAMES), NAMES)).toBe(il);
    expect(extractIl('Out0 := In0;', NAMES)).toBeNull();
  });
});

describe('R07 cross-language semantics: the same start/stop latch in Ladder, Structured Text, IL and SFC behaves identically scan by scan', () => {
  const ladder = { id: 'latch', version: '1', rungs: [{ id: 'r1', coil: 'Out0', elements: [
    { type: 'branch', alternatives: [[{ type: 'contact', tag: 'In0' }], [{ type: 'contact', tag: 'Out0' }]] },
    { type: 'contact', tag: 'In1', normallyClosed: true }] }] };
  const sfc: SfcDocument = { steps: [{ id: 'Off', initial: true }, { id: 'On', actions: [{ q: 'N', tag: 'Out0' }] }],
    transitions: [{ from: ['Off'], to: ['On'], when: 'In0 AND NOT In1' }, { from: ['On'], to: ['Off'], when: 'In1' }] };
  const loaders: Record<string, Command> = {
    ladder: { k: 'loadProgram', program: ladder as never },
    st: { k: 'loadST', source: 'VAR_INPUT In0 : BOOL; In1 : BOOL; END_VAR\nVAR_OUTPUT Out0 : BOOL; END_VAR\nOut0 := (In0 OR Out0) AND NOT In1;' },
    il: { k: 'loadIL', source: 'LD In0\nOR Out0\nANDN In1\nST Out0' },
    sfc: { k: 'loadSFC', document: sfc },
  };
  // start, hold, stop, restart, stop and start together, release, start, long hold
  const stimulus: Array<Record<string, boolean>> = [
    { In0: F, In1: F }, { In0: T, In1: F }, { In0: F, In1: F }, { In0: F, In1: F }, { In0: F, In1: T }, { In0: F, In1: F },
    { In0: T, In1: F }, { In0: T, In1: T }, { In0: F, In1: T }, { In0: F, In1: F }, { In0: T, In1: F }, { In0: F, In1: F }, { In0: F, In1: F },
  ];
  const traces = Object.fromEntries(Object.entries(loaders).map(([name, cmd]) => {
    const w = tick(base(), [cmd]).world;
    expect(w.lastError, name).toBeNull();
    return [name, trace(w, stimulus, ['Out0']).map(r => r[0])];
  }));
  it('all four languages produce the same output on every scan', () => {
    expect(traces.st).toEqual([F, T, T, T, F, F, T, F, F, F, T, T, T]);              // the reference behaviour
    expect(traces.ladder).toEqual(traces.st);
    expect(traces.il).toEqual(traces.st);
    expect(traces.sfc).toEqual(traces.st);
  });
});
