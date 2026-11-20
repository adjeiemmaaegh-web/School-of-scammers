import { describe, expect, it } from 'vitest';
import { createWorld, tick, validateSandboxProgram } from '../src/sim/orchestrator';
import { ladderScanCost, MAX_SANDBOX_ELEMENTS, MAX_SANDBOX_RUNGS, MAX_SANDBOX_SYMBOLS } from '../src/program/p2-contract';
import { compileStructuredText, executeStructuredText, ST_MAX_DECLARATIONS, ST_MAX_STATEMENTS_PER_SCAN, type STValue } from '../src/engineering/structured-text';
import { executeLadder, type LadderDocument } from '../src/engineering/ladder';
import type { Command, WorldState } from '../src/sim/signals';

const contact = (tag: string) => ({ type: 'contact' as const, tag });
/** A chain: Aux0 follows Start, AuxN follows Aux(N-1): N rungs, N tags, one scan propagates the whole chain. */
const chain = (n: number): LadderDocument => ({
  id: `chain-${n}`, version: '1.0',
  symbols: Object.fromEntries(Array.from({ length: n }, (_, i) => [`Aux${i}`, { description: `link ${i}` }])),
  rungs: [...Array.from({ length: n }, (_, i) => ({ id: `r${i}`, elements: [contact(i === 0 ? 'Start' : `Aux${i - 1}`)], coil: `Aux${i}` })),
  ],
});

describe('R08 capacity: raised limits with measurable budgets', () => {
  it('the old 32/48 caps are gone and the new caps are substantial', () => {
    expect(MAX_SANDBOX_RUNGS).toBeGreaterThanOrEqual(256);
    expect(MAX_SANDBOX_SYMBOLS).toBeGreaterThanOrEqual(512);
    expect(ST_MAX_DECLARATIONS).toBeGreaterThanOrEqual(512);
    expect(ST_MAX_STATEMENTS_PER_SCAN).toBeGreaterThanOrEqual(5000);
  });
  it('a program at the rung cap validates; one rung more is refused with a clear message', () => {
    expect(validateSandboxProgram(chain(MAX_SANDBOX_RUNGS))).toEqual([]);
    const over = chain(MAX_SANDBOX_RUNGS + 1);
    expect(validateSandboxProgram(over).join(' ')).toMatch(new RegExp(`at most ${MAX_SANDBOX_RUNGS} Ladder rungs`));
  });
  it('the tag cap is enforced independently of the rung cap', () => {
    const tags = { ...chain(2), symbols: Object.fromEntries(Array.from({ length: MAX_SANDBOX_SYMBOLS + 1 }, (_, i) => [`T${i}`, { description: 't' }])) };
    expect(validateSandboxProgram({ ...tags, rungs: [{ id: 'a', elements: [contact('Start')], coil: 'T0' }] }).join(' ')).toMatch(new RegExp(`at most ${MAX_SANDBOX_SYMBOLS} local tags`));
    const exactly = { ...tags, symbols: Object.fromEntries(Array.from({ length: MAX_SANDBOX_SYMBOLS }, (_, i) => [`T${i}`, { description: 't' }])) };
    expect(validateSandboxProgram({ ...exactly, rungs: [{ id: 'a', elements: [contact('Start')], coil: 'T0' }] })).toEqual([]);
  });
  it('the static scan-cost budget stops a program that fits the rung cap but is too expensive per scan', () => {
    /** `rungs` independent rungs, each with 8 series contacts (the most one rung allows) and its own coil: cost = rungs x 9. */
    const doc = (rungs: number): LadderDocument => ({
      id: 'wide', version: '1.0',
      symbols: Object.fromEntries(Array.from({ length: rungs }, (_, i) => [`Out${i}`, { description: 'o' }])),
      rungs: Array.from({ length: rungs }, (_, i) => ({ id: `r${i}`, elements: Array.from({ length: 8 }, () => contact('Start')), coil: `Out${i}` })),
    });
    const cheap = doc(200), costly = doc(MAX_SANDBOX_RUNGS);
    expect(ladderScanCost(cheap)).toBe(200 * 9);
    expect(validateSandboxProgram(cheap)).toEqual([]);
    expect(ladderScanCost(costly)).toBe(MAX_SANDBOX_RUNGS * 9);
    expect(ladderScanCost(costly)).toBeGreaterThan(MAX_SANDBOX_ELEMENTS);
    expect(validateSandboxProgram(costly).join(' ')).toMatch(new RegExp(`scan cost ${MAX_SANDBOX_RUNGS * 9} exceeds the budget of ${MAX_SANDBOX_ELEMENTS}`));
  });
  it('branch contacts count towards scan cost', () => {
    const doc: LadderDocument = { id: 'b', version: '1.0', symbols: { X: { description: 'x' } },
      rungs: [{ id: 'r', elements: [{ type: 'branch', alternatives: [[contact('Start')], [contact('StopOK'), contact('Start')]] } as never], coil: 'X' }] };
    expect(ladderScanCost(doc)).toBe(3 + 1);
  });
  it('a maximum-size Ladder program executes correctly and deterministically in one scan', () => {
    const doc = chain(MAX_SANDBOX_RUNGS);
    const run = () => executeLadder(doc, { Start: true } as never, {}, {}, 50);
    const a = run(), b = run();
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.outputs[`Aux${MAX_SANDBOX_RUNGS - 1}`]).toBe(true);
    expect(executeLadder(doc, { Start: false } as never, {}, {}, 50).outputs[`Aux${MAX_SANDBOX_RUNGS - 1}`]).toBe(false);
  });
  it('a large program runs inside the real engine: loaded through the command path and scanned', () => {
    const base = tick(createWorld(), [
      { k: 'place', id: 'ps', kind: 'supply', at: { x: 10, y: 10 } }, { k: 'place', id: 'plc', kind: 'plc', at: { x: 280, y: 10 } },
      { k: 'place', id: 'start', kind: 'start', at: { x: 10, y: 240 } }, { k: 'place', id: 'lamp', kind: 'lamp', at: { x: 560, y: 10 } },
      { k: 'wire', id: 'w1', from: 'ps.P24', to: 'plc.L+' }, { k: 'wire', id: 'w2', from: 'ps.M0', to: 'plc.M' },
      { k: 'wire', id: 'w3', from: 'ps.P24', to: 'start.A' }, { k: 'wire', id: 'w4', from: 'start.B', to: 'plc.I0.0' },
      { k: 'wire', id: 'w5', from: 'plc.Q0.0', to: 'lamp.L+' }, { k: 'wire', id: 'w6', from: 'lamp.M-', to: 'ps.M0' },
    ] as Command[]).world;
    const link = chain(200);
    const big: LadderDocument = { ...link, rungs: [...link.rungs, { id: 'out', elements: [contact('Aux199')], coil: 'Run' }] };
    let w: WorldState = tick(base, [{ k: 'loadProgram', program: big }, { k: 'run' }, { k: 'operate', id: 'start', pressed: true }]).world;
    expect(w.lastError).toBeNull();
    for (let i = 0; i < 6; i++) w = tick(w).world;
    expect(w.coils.Run).toBe(true);
  });
});

describe('R08 Structured Text capacity', () => {
  it('compiles a program with hundreds of declarations and refuses one more than the limit', () => {
    const decls = (n: number) => Array.from({ length: n }, (_, i) => `  v${i} : BOOL;`).join('\n');
    const src = (n: number) => `VAR_INPUT\n  Go : BOOL;\nEND_VAR\nVAR_OUTPUT\n  Q : BOOL;\nEND_VAR\nVAR\n${decls(n)}\nEND_VAR\nQ := Go;`;
    expect(() => compileStructuredText(src(ST_MAX_DECLARATIONS - 2))).not.toThrow();
    expect(() => compileStructuredText(src(ST_MAX_DECLARATIONS + 5))).toThrow(/declaration limit/);
  });
  it('executes thousands of statements per scan; refuses oversize programs at compile time and runaway loops at run time', () => {
    const body = (n: number) => Array.from({ length: n }, () => 'N := N + 1;').join('\n');
    const src = (n: number) => `VAR_INPUT\n  Go : BOOL;\nEND_VAR\nVAR_OUTPUT\n  N : DINT;\nEND_VAR\nN := 0;\n${body(n)}`;
    const ok = compileStructuredText(src(ST_MAX_STATEMENTS_PER_SCAN - 10));
    expect(executeStructuredText(ok, { Go: true }, {} as Record<string, STValue>).outputs.N).toBe(ST_MAX_STATEMENTS_PER_SCAN - 10);
    // Static guard: too many statements never compiles.
    expect(() => compileStructuredText(src(ST_MAX_STATEMENTS_PER_SCAN + 10))).toThrow(/Statement limit/);
    // Dynamic guard: a small program whose loops would execute far more than the per-scan budget is stopped mid-scan.
    const loops = compileStructuredText(['VAR_INPUT', '  Go : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  N : DINT;', 'END_VAR', 'VAR', '  i : INT;', '  j : INT;', 'END_VAR',
      'N := 0;', 'FOR i := 1 TO 100 DO', '  FOR j := 1 TO 100 DO', '    N := N + 1;', '  END_FOR;', 'END_FOR;'].join('\n'));
    expect(() => executeStructuredText(loops, { Go: true }, {})).toThrow(/statement budget/);
    const small = compileStructuredText(['VAR_INPUT', '  Go : BOOL;', 'END_VAR', 'VAR_OUTPUT', '  N : DINT;', 'END_VAR', 'VAR', '  i : INT;', '  j : INT;', 'END_VAR',
      'N := 0;', 'FOR i := 1 TO 30 DO', '  FOR j := 1 TO 30 DO', '    N := N + 1;', '  END_FOR;', 'END_FOR;'].join('\n'));
    expect(executeStructuredText(small, { Go: true }, {}).outputs.N).toBe(900);
  });
});
