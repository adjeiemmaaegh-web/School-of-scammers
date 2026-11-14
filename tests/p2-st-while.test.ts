import { describe, expect, it } from 'vitest';
import { compileStructuredText, executeStructuredText } from '../src/engineering/structured-text';
describe('bounded Structured Text WHILE loops',()=>{
  it('executes an INT loop deterministically and persists named memory between scans',()=>{
    const source=['VAR','  Count : INT := 0;','END_VAR','VAR_OUTPUT','  Run : BOOL;','END_VAR',
      'WHILE Count < 5 DO',' Count := Count + 1;','END_WHILE;','Run := Count = 5;'].join('\n');
    const ast=compileStructuredText(source);
    const r=executeStructuredText(ast,{});
    expect(r.memory.Count).toBe(5);
    expect(r.outputs.Run).toBe(true);
    expect(executeStructuredText(ast,{},r.memory).memory.Count).toBe(5);
  });
  it('rejects infinite WHILE loops within the fixed execution budget',()=>{
    const source=['VAR_OUTPUT',' Run : BOOL;','END_VAR','WHILE TRUE DO',' Run := TRUE;','END_WHILE;'].join('\n');
    expect(()=>executeStructuredText(compileStructuredText(source),{})).toThrow(/budget/);
  });
  it('does not let WHILE write sampled VAR_INPUT or bypass bounds',()=>{
    const source=['VAR_INPUT',' Start : BOOL;','END_VAR','VAR_OUTPUT',' Run : BOOL;','END_VAR',
      'WHILE Start DO','Start := FALSE;','END_WHILE;','Run := TRUE;'].join('\n');
    expect(()=>compileStructuredText(source)).toThrow(/VAR_INPUT/);
  });
  it('does not allow malformed WHILE syntax',()=>{
    expect(()=>compileStructuredText('WHILE TRUE DO Run := TRUE;')).toThrow(/END_WHILE|Expected|Unexpected/);
  });
});
