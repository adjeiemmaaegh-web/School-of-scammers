import { describe, expect, it } from 'vitest';
import { compileStructuredText, executeStructuredText, type STValue } from '../src/engineering/structured-text';

const src = (call: string) => compileStructuredText(['VAR_INPUT', '  PV : REAL;', '  SP : REAL;', 'END_VAR', 'VAR_OUTPUT', '  U : REAL;', 'END_VAR', 'VAR', '  loop : PID;', 'END_VAR', call, 'U := loop.OUT;'].join('\n'));
const run = (p: ReturnType<typeof src>, inputs: { PV: number; SP: number }[]) => {
  let memory: Record<string, STValue> = {};
  return inputs.map(i => { const r = executeStructuredText(p, i, memory); memory = r.memory; return Number(r.outputs.U); });
};
const same = (n: number, v: { PV: number; SP: number }) => Array.from({ length: n }, () => v);

describe('ST PID function block (teaching model)', () => {
  it('proportional only: OUT = KP * error, clamped to the output limits', () => {
    const p = src('loop(PV := PV, SP := SP, KP := 2.0, KI := 0.0, KD := 0.0, OUT_MIN := 0.0, OUT_MAX := 100.0);');
    expect(run(p, [{ PV: 10, SP: 30 }, { PV: 10, SP: 80 }, { PV: 90, SP: 30 }])).toEqual([40, 100, 0]);
  });
  it('clamps an output that is only just beyond a limit', () => {
    const p = src('loop(PV := PV, SP := SP, KP := 1.0, KI := 0.0, KD := 0.0, OUT_MIN := 0.0, OUT_MAX := 100.0);');
    expect(run(p, [{ PV: 0, SP: 100.5 }, { PV: 0.5, SP: 0 }])).toEqual([100, 0]);
  });
  it('integral action accumulates per second (KI * error * 0.05 per scan)', () => {
    const p = src('loop(PV := PV, SP := SP, KP := 0.0, KI := 4.0, KD := 0.0, OUT_MIN := -1000.0, OUT_MAX := 1000.0);');
    const u = run(p, same(4, { PV: 0, SP: 10 }));
    u.forEach((v, i) => expect(v).toBeCloseTo(2 * (i + 1), 9));
  });
  it('derivative acts on error change and not on the first scan', () => {
    const p = src('loop(PV := PV, SP := SP, KP := 0.0, KI := 0.0, KD := 1.0, OUT_MIN := -1000.0, OUT_MAX := 1000.0);');
    const u = run(p, [{ PV: 0, SP: 10 }, { PV: 0, SP: 10 }, { PV: 5, SP: 10 }]);
    expect(u[0]).toBe(0); expect(u[1]).toBe(0); expect(u[2]).toBeCloseTo(-100, 9);
  });
  it('anti-windup: a long saturation does not build an integral that overshoots after recovery', () => {
    const p = src('loop(PV := PV, SP := SP, KP := 1.0, KI := 2.0, KD := 0.0, OUT_MIN := 0.0, OUT_MAX := 10.0);');
    const sat = run(p, same(400, { PV: 0, SP: 100 }));
    expect(sat.every(v => v === 10)).toBe(true);
    const recover = run(p, [...same(400, { PV: 0, SP: 100 }), ...same(3, { PV: 100, SP: 100 })]).slice(400);
    expect(recover[0]).toBeLessThan(1); // would stay pinned near 10 for seconds with a wound-up integral
  });
  it('closed loop against a first-order process converges to the setpoint with no steady-state error', () => {
    const p = src('loop(PV := PV, SP := SP, KP := 2.0, KI := 1.5, KD := 0.0, OUT_MIN := 0.0, OUT_MAX := 100.0);');
    let memory: Record<string, STValue> = {}, pv = 0, peak = 0;
    for (let i = 0; i < 1600; i++) {
      const r = executeStructuredText(p, { PV: pv, SP: 50 }, memory); memory = r.memory;
      pv += 0.05 * (-pv + 0.8 * Number(r.outputs.U)) / 2; peak = Math.max(peak, pv);
    }
    expect(pv).toBeCloseTo(50, 1); expect(peak).toBeLessThan(65);
  });
  it('is deterministic and keeps its state in the declared instance memory', () => {
    const p = src('loop(PV := PV, SP := SP, KP := 1.0, KI := 1.0, KD := 0.1, OUT_MIN := 0.0, OUT_MAX := 100.0);');
    const seq = [...same(20, { PV: 3, SP: 40 }), ...same(20, { PV: 30, SP: 40 })];
    expect(run(p, seq)).toEqual(run(p, seq));
    const r = executeStructuredText(p, { PV: 3, SP: 40 }, {});
    expect(Object.keys(r.memory).some(k => /LOOP__INTEG/.test(k))).toBe(true);
  });
  it('rejects bad use: swapped limits, non-finite input, unknown member, wrong declaration scope', () => {
    expect(() => run(src('loop(PV := PV, SP := SP, OUT_MIN := 10.0, OUT_MAX := 5.0);'), [{ PV: 0, SP: 1 }])).toThrow(/OUT_MIN/);
    expect(() => run(src('loop(PV := PV, SP := SP, KP := 1.0 / 0.0);'), [{ PV: 0, SP: 1 }])).toThrow();
    expect(() => src('loop(PV := PV, GAIN := 1.0);')).toThrow(/not an input of PID/);
    expect(() => compileStructuredText('VAR_INPUT\n  PV : REAL;\nEND_VAR\nVAR_OUTPUT\n  U : REAL;\nEND_VAR\nVAR_OUTPUT\n  x : PID;\nEND_VAR\nU := PV;')).toThrow(/VAR block/);
    expect(() => src('loop(PV := PV);\nU := loop.INTEG;')).toThrow(/not an output of PID/);
  });
});
