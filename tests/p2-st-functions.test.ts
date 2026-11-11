import { describe, expect, it } from 'vitest';
import { compileStructuredText, executeStructuredText } from '../src/engineering/structured-text';

describe('P2 deterministic IEC-style bounded numeric functions',()=>{
  const compile = (statement:string) => compileStructuredText([
    'VAR','  x : REAL := 0;','END_VAR','VAR_OUTPUT','  Run : BOOL;','END_VAR',
    statement,'Run := x >= 0;',
  ].join('\n'));
  it('evaluates ABS MIN MAX and LIMIT using typed numeric values',()=>{
    expect(executeStructuredText(compile('x := ABS(-5) + MIN(1, 2) + MAX(3, 4);'),{}).memory.x).toBe(10);
    expect(executeStructuredText(compile('x := LIMIT(0, 120, 100);'),{}).memory.x).toBe(100);
    expect(executeStructuredText(compile('x := LIMIT(-5, -9, 8);'),{}).memory.x).toBe(-5);
  });
  it('rejects wrong function arity, mixed BOOL arguments and inverted limits',()=>{
    expect(()=>compile('x := ABS();')).toThrow(/arity/);
    expect(()=>compile('x := MAX(1);')).toThrow(/arity/);
    expect(()=>executeStructuredText(compile('x := ABS(TRUE);'),{})).toThrow(/numeric/);
    expect(()=>executeStructuredText(compile('x := LIMIT(10, 5, 1);'),{})).toThrow(/LIMIT/);
  });
  it('never invokes arbitrary user functions or JavaScript evaluation',()=>{
    expect(()=>compile('x := process(1);')).toThrow();
  });
});
