import { describe, expect, it } from 'vitest';
import { compileStructuredText, executeStructuredText, ST_MAX_ARRAY_ELEMENTS } from '../src/engineering/structured-text';
import type { STSignals, STValue } from '../src/engineering/structured-text';

const scan = (src: string, inputs: STSignals = {}, scans = 1, memory: STSignals = {}) => {
  const program = compileStructuredText(src);
  let mem = memory, last = executeStructuredText(program, inputs, mem);
  mem = last.memory;
  for (let i = 1; i < scans; i++) { last = executeStructuredText(program, inputs, mem); mem = last.memory; }
  return last;
};
const bad = (src: string) => { try { compileStructuredText(src); return null; } catch (e) { return (e as Error).message; } };

describe('R07 arrays', () => {
  const sum = `VAR_INPUT n : INT; END_VAR VAR_OUTPUT total : INT; END_VAR VAR a : ARRAY[1..5] OF INT; i : INT; END_VAR
    FOR i := 1 TO 5 DO a[i] := i * n; END_FOR;
    total := 0;
    FOR i := 1 TO 5 DO total := total + a[i]; END_FOR;`;
  it('elements are stored, indexed by a variable, and summed in a loop', () => {
    expect(scan(sum, { n: 2 }).outputs.total).toBe(30);        // 2*(1+2+3+4+5)
    expect(scan(sum, { n: 0 }).outputs.total).toBe(0);
  });
  it('a constant index and a non-zero lower bound work; an initial value fills every element', () => {
    const r = scan(`VAR_OUTPUT x : INT; y : INT; END_VAR VAR t : ARRAY[10..12] OF INT := 7; END_VAR x := t[10] + t[12]; y := 0; t[11] := 5; y := t[11];`);
    expect(r.outputs.x).toBe(14); expect(r.outputs.y).toBe(5);
  });
  it('an out-of-range index is refused at compile time (constant) or at run time (variable)', () => {
    expect(bad(`VAR_OUTPUT x : INT; END_VAR VAR t : ARRAY[1..3] OF INT; END_VAR x := t[4];`)).toMatch(/outside/);
    expect(bad(`VAR_OUTPUT x : INT; END_VAR VAR t : ARRAY[1..3] OF INT; END_VAR t[0] := 1; x := 1;`)).toMatch(/outside/);
    expect(() => scan(`VAR_INPUT k : INT; END_VAR VAR_OUTPUT x : INT; END_VAR VAR t : ARRAY[1..3] OF INT; END_VAR x := t[k];`, { k: 9 })).toThrow(/outside t\[1\.\.3\]/i);
    expect(() => scan(`VAR_INPUT k : INT; END_VAR VAR_OUTPUT x : INT; END_VAR VAR t : ARRAY[1..3] OF INT; END_VAR t[k] := 1; x := 1;`, { k: 0 })).toThrow(/outside/);
  });
  it('arrays keep their values between scans (scan memory) and obey element type limits', () => {
    const src = `VAR_OUTPUT c : INT; END_VAR VAR h : ARRAY[0..2] OF INT; END_VAR h[1] := h[1] + 1; c := h[1];`;
    expect(scan(src, {}, 4).outputs.c).toBe(4);
    expect(() => scan(`VAR_OUTPUT x : INT; END_VAR VAR h : ARRAY[0..1] OF INT; END_VAR h[0] := 40000; x := h[0];`)).toThrow();
  });
  it('size and declaration rules: at most 64 elements, valid bounds, element types', () => {
    expect(bad(`VAR_OUTPUT x : INT; END_VAR VAR t : ARRAY[1..${ST_MAX_ARRAY_ELEMENTS + 1}] OF INT; END_VAR x := 1;`)).toMatch(/elements/);
    expect(bad(`VAR_OUTPUT x : INT; END_VAR VAR t : ARRAY[5..1] OF INT; END_VAR x := 1;`)).toMatch(/elements/);
    expect(bad(`VAR_OUTPUT x : INT; END_VAR VAR t : ARRAY[1..3] OF TON; END_VAR x := 1;`)).toMatch(/Unsupported array element type/);
    expect(bad(`VAR_OUTPUT x : INT; END_VAR x := nope[1];`)).toBeTruthy();
    expect(compileStructuredText(`VAR_OUTPUT x : INT; END_VAR VAR t : ARRAY[1..${ST_MAX_ARRAY_ELEMENTS}] OF INT; END_VAR x := t[1];`)).toBeTruthy();
  });
  it('a bounded loop over a big array stays inside the execution budget', () => {
    const r = scan(`VAR_OUTPUT total : DINT; END_VAR VAR a : ARRAY[0..63] OF INT; i : INT; END_VAR
      FOR i := 0 TO 63 DO a[i] := i; END_FOR; total := 0; FOR i := 0 TO 63 DO total := total + a[i]; END_FOR;`);
    expect(r.outputs.total).toBe(2016);
  });
});

describe('R07 structures', () => {
  const src = `TYPE motor_t : STRUCT run : BOOL; speed : INT := 10; END_STRUCT END_TYPE
    VAR_INPUT go : BOOL; END_VAR VAR_OUTPUT out : INT; END_VAR VAR m : motor_t; END_VAR
    m.run := go; IF m.run THEN m.speed := m.speed + 5; END_IF; out := m.speed;`;
  it('fields are read and written with dot notation and have initial values and per-field types', () => {
    expect(scan(src, { go: false }).outputs.out).toBe(10);
    expect(scan(src, { go: true }).outputs.out).toBe(15);
    expect(scan(src, { go: true }, 3).outputs.out).toBe(25);       // state persists per field
  });
  it('two instances are independent', () => {
    const r = scan(`TYPE t : STRUCT n : INT; END_STRUCT END_TYPE VAR_OUTPUT a : INT; b : INT; END_VAR VAR p : t; q : t; END_VAR p.n := 3; q.n := 9; a := p.n; b := q.n;`);
    expect(r.outputs.a).toBe(3); expect(r.outputs.b).toBe(9);
  });
  it('unknown fields and duplicate fields/types are rejected', () => {
    expect(bad(`TYPE t : STRUCT n : INT; END_STRUCT END_TYPE VAR_OUTPUT a : INT; END_VAR VAR p : t; END_VAR a := p.zz;`)).toMatch(/not a field/);
    expect(bad(`TYPE t : STRUCT n : INT; n : INT; END_STRUCT END_TYPE VAR_OUTPUT a : INT; END_VAR a := 1;`)).toMatch(/Duplicate field/);
    expect(bad(`TYPE t : STRUCT n : INT; END_STRUCT END_TYPE TYPE t : STRUCT m : INT; END_STRUCT END_TYPE VAR_OUTPUT a : INT; END_VAR a := 1;`)).toMatch(/Duplicate type/);
  });
});

describe('R07 user functions', () => {
  const fn = `FUNCTION scale2 : INT VAR_INPUT x : INT; k : INT; END_VAR scale2 := x * k + 1; END_FUNCTION
    VAR_INPUT v : INT; END_VAR VAR_OUTPUT r : INT; END_VAR r := scale2(v, 3);`;
  it('a function computes and returns its result', () => {
    expect(scan(fn, { v: 4 }).outputs.r).toBe(13);
  });
  it('calls nest and may appear twice in one expression with independent state', () => {
    const r = scan(`FUNCTION sq : INT VAR_INPUT x : INT; END_VAR sq := x * x; END_FUNCTION
      VAR_INPUT v : INT; END_VAR VAR_OUTPUT a : INT; b : INT; END_VAR a := sq(v) + sq(v + 1); b := sq(sq(v));`, { v: 2 });
    expect(r.outputs.a).toBe(13); expect(r.outputs.b).toBe(16);
  });
  it('a function can use IF, loops and local variables, and one function can call another', () => {
    const r = scan(`FUNCTION clampPos : INT VAR_INPUT x : INT; END_VAR IF x < 0 THEN clampPos := 0; ELSE clampPos := x; END_IF; END_FUNCTION
      FUNCTION sumTo : INT VAR_INPUT n : INT; END_VAR VAR i : INT; acc : INT; END_VAR
        acc := 0; FOR i := 1 TO clampPos(n) DO acc := acc + i; END_FOR; sumTo := acc; END_FUNCTION
      VAR_INPUT n : INT; END_VAR VAR_OUTPUT s : INT; END_VAR s := sumTo(n);`, { n: 4 });
    expect(r.outputs.s).toBe(10);
    expect(scan(`FUNCTION clampPos : INT VAR_INPUT x : INT; END_VAR IF x < 0 THEN clampPos := 0; ELSE clampPos := x; END_IF; END_FUNCTION
      FUNCTION sumTo : INT VAR_INPUT n : INT; END_VAR VAR i : INT; acc : INT; END_VAR
        acc := 0; FOR i := 1 TO clampPos(n) DO acc := acc + i; END_FOR; sumTo := acc; END_FUNCTION
      VAR_INPUT n : INT; END_VAR VAR_OUTPUT s : INT; END_VAR s := sumTo(n);`, { n: -5 }).outputs.s).toBe(0);
  });
  it('a function has no memory between scans: locals restart each call', () => {
    const src = `FUNCTION bump : INT VAR cnt : INT; END_VAR cnt := cnt + 1; bump := cnt; END_FUNCTION
      VAR_OUTPUT r : INT; END_VAR r := bump();`;
    expect(scan(src, {}, 3).outputs.r).toBe(1);
  });
  it('argument count, recursion and WHILE-condition misuse are refused', () => {
    expect(bad(fn.replace('scale2(v, 3)', 'scale2(v)'))).toMatch(/takes 2 argument/);
    expect(bad(`FUNCTION f : INT VAR_INPUT x : INT; END_VAR f := f(x); END_FUNCTION VAR_INPUT v : INT; END_VAR VAR_OUTPUT r : INT; END_VAR r := f(v);`)).toMatch(/recursion is not supported/);
    expect(bad(`FUNCTION f : INT VAR_INPUT x : INT; END_VAR f := g(x); END_FUNCTION FUNCTION g : INT VAR_INPUT x : INT; END_VAR g := f(x); END_FUNCTION VAR_INPUT v : INT; END_VAR VAR_OUTPUT r : INT; END_VAR r := f(v);`)).toMatch(/Call depth/);
    expect(bad(`FUNCTION f : INT VAR_INPUT x : INT; END_VAR f := x; END_FUNCTION VAR_INPUT v : INT; END_VAR VAR_OUTPUT r : INT; END_VAR WHILE f(v) > 0 DO r := 1; END_WHILE;`)).toMatch(/WHILE/);
    expect(bad(`FUNCTION f : INT VAR_INPUT x : INT; END_VAR f := x; END_FUNCTION FUNCTION f : INT VAR_INPUT x : INT; END_VAR f := x; END_FUNCTION VAR_OUTPUT r : INT; END_VAR r := 1;`)).toMatch(/Duplicate definition/);
  });
  it('typed results are checked: an INT function result out of range is a run-time error', () => {
    expect(() => scan(`FUNCTION big : INT VAR_INPUT x : INT; END_VAR big := x * 1000; END_FUNCTION VAR_INPUT v : INT; END_VAR VAR_OUTPUT r : INT; END_VAR r := big(v);`, { v: 100 })).toThrow();
  });
});

describe('R07 user function blocks', () => {
  const blk = `FUNCTION_BLOCK Counter VAR_INPUT up : BOOL; reset : BOOL; END_VAR VAR_OUTPUT value : INT; END_VAR VAR prev : BOOL; END_VAR
      IF reset THEN value := 0; ELSIF up AND NOT prev THEN value := value + 1; END_IF; prev := up; END_FUNCTION_BLOCK`;
  it('an instance keeps its own state between scans and counts rising edges', () => {
    const program = compileStructuredText(`${blk}
      VAR_INPUT pulse : BOOL; clr : BOOL; END_VAR VAR_OUTPUT n : INT; END_VAR VAR c : Counter; END_VAR c(up := pulse, reset := clr); n := c.value;`);
    let mem: STSignals = {}, n = 0;
    for (const p of [false, true, true, false, true, false, true]) { const r = executeStructuredText(program, { pulse: p, clr: false }, mem); mem = r.memory; n = r.outputs.n as number; }
    expect(n).toBe(3);
    const cleared = executeStructuredText(program, { pulse: false, clr: true }, mem);
    expect(cleared.outputs.n).toBe(0);
  });
  it('two instances do not share state', () => {
    const program = compileStructuredText(`${blk}
      VAR_INPUT a : BOOL; b : BOOL; END_VAR VAR_OUTPUT na : INT; nb : INT; END_VAR VAR c1 : Counter; c2 : Counter; END_VAR
      c1(up := a, reset := FALSE); c2(up := b, reset := FALSE); na := c1.value; nb := c2.value;`);
    let mem: STSignals = {}, last: Record<string, STValue> = {};
    const feed = [[true, false], [false, false], [true, true], [false, false], [true, false]];
    for (const [a, b] of feed) { const r = executeStructuredText(program, { a, b }, mem); mem = r.memory; last = r.outputs; }
    expect(last.na).toBe(3); expect(last.nb).toBe(1);
  });
  it('a block can contain a standard timer and use it across scans', () => {
    const program = compileStructuredText(`FUNCTION_BLOCK Delay VAR_INPUT go : BOOL; END_VAR VAR_OUTPUT done : BOOL; END_VAR VAR t : TON; END_VAR
        t(IN := go, PT := 200); done := t.Q; END_FUNCTION_BLOCK
      VAR_INPUT start : BOOL; END_VAR VAR_OUTPUT ok : BOOL; END_VAR VAR d : Delay; END_VAR d(go := start); ok := d.done;`);
    let mem: STSignals = {}, outs: boolean[] = [];
    for (let i = 0; i < 8; i++) { const r = executeStructuredText(program, { start: true }, mem, undefined as never); mem = r.memory; outs.push(r.outputs.ok as boolean); }
    expect(outs[0]).toBe(false); expect(outs[7]).toBe(true);
    expect(outs.indexOf(true)).toBeGreaterThanOrEqual(3);          // 200 ms at 50 ms/scan
  });
  it('unknown inputs, outputs and misplaced instances are rejected', () => {
    expect(bad(`${blk} VAR_INPUT p : BOOL; END_VAR VAR_OUTPUT n : INT; END_VAR VAR c : Counter; END_VAR c(nope := p); n := 1;`)).toMatch(/not an input/);
    expect(bad(`${blk} VAR_INPUT p : BOOL; END_VAR VAR_OUTPUT n : INT; END_VAR VAR c : Counter; END_VAR c(up := p); n := c.prev;`)).toMatch(/not an output/);
    expect(bad(`${blk} VAR_OUTPUT c : Counter; END_VAR VAR_OUTPUT n : INT; END_VAR n := 1;`)).toMatch(/VAR block/);
  });
});

describe('R07 math and analog functions', () => {
  const calc = (expr: string, inputs: STSignals = {}) => scan(`VAR_INPUT x : REAL; END_VAR VAR_OUTPUT y : REAL; END_VAR y := ${expr};`, { x: 0, ...inputs }).outputs.y as number;
  it('square root, trigonometry, logarithms, exponent and truncation', () => {
    expect(calc('SQRT(x)', { x: 9 })).toBe(3);
    expect(calc('SIN(x)', { x: 0 })).toBe(0);
    expect(calc('COS(x)', { x: 0 })).toBe(1);
    expect(calc('ATAN(x)', { x: 1 })).toBeCloseTo(Math.PI / 4, 9);
    expect(calc('LN(x)', { x: Math.E })).toBeCloseTo(1, 9);
    expect(calc('LOG(x)', { x: 1000 })).toBeCloseTo(3, 9);
    expect(calc('EXP(x)', { x: 0 })).toBe(1);
    expect(calc('TRUNC(x)', { x: -2.7 })).toBe(-2);
  });
  it('domain errors are run-time errors, not NaN', () => {
    expect(() => calc('SQRT(x)', { x: -1 })).toThrow(/out of range/);
    expect(() => calc('LN(x)', { x: 0 })).toThrow(/out of range/);
  });
  it('SCALE maps an analog range to engineering units (4-20 mA to 0-100 degrees)', () => {
    expect(calc('SCALE(x, 4.0, 20.0, 0.0, 100.0)', { x: 4 })).toBe(0);
    expect(calc('SCALE(x, 4.0, 20.0, 0.0, 100.0)', { x: 12 })).toBe(50);
    expect(calc('SCALE(x, 4.0, 20.0, 0.0, 100.0)', { x: 20 })).toBe(100);
    expect(() => calc('SCALE(x, 4.0, 4.0, 0.0, 100.0)')).toThrow(/different input bounds/);
    expect(bad('VAR_INPUT x : REAL; END_VAR VAR_OUTPUT y : REAL; END_VAR y := SCALE(x, 1.0, 2.0);')).toMatch(/arity/);
  });
});
