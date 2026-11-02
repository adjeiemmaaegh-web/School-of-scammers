import {describe,it,expect} from 'vitest';
import {compileStructuredText,executeStructuredText,runStructuredTextScans,ST_DEMO} from '../src/engineering/structured-text';

describe('bounded Structured Text interpreter',()=>{
 it('preserves BOOL seal-in output across scans and implements stop priority',()=>{
  const p=compileStructuredText(ST_DEMO);
  let r=executeStructuredText(p,{Start:true,Stop:false,EStopOK:true,GuardClosed:true},{Run:false});expect(r.outputs.Run).toBe(true);
  r=executeStructuredText(p,{Start:false,Stop:false,EStopOK:true,GuardClosed:true},r.outputs);expect(r.outputs.Run).toBe(true);
  r=executeStructuredText(p,{Start:false,Stop:true,EStopOK:true,GuardClosed:true},r.outputs);expect(r.outputs.Run).toBe(false);
  r=executeStructuredText(p,{Start:true,Stop:false,EStopOK:false,GuardClosed:true},r.outputs);expect(r.outputs.Run).toBe(false);
 });
 it('uses conventional numeric precedence, parentheses and comparisons',()=>{
  const p=compileStructuredText('A := 1 + 2 * 3; B := (1 + 2) * 3; IF A = 7 AND B >= 9 THEN OK := TRUE; ELSE OK := FALSE; END_IF;');
  expect(executeStructuredText(p,{}).outputs).toEqual({A:7,B:9,OK:true});
 });
 it('evaluates ELSE and multiple ELSIF branches',()=>{
  const p=compileStructuredText('IF Value < 10 THEN State := 1; ELSIF Value <= 20 THEN State := 2; ELSE State := 3; END_IF;');
  expect(executeStructuredText(p,{Value:5}).outputs.State).toBe(1);
  expect(executeStructuredText(p,{Value:20}).outputs.State).toBe(2);
  expect(executeStructuredText(p,{Value:21}).outputs.State).toBe(3);
 });
 it('rejects uninitialized tag and attempts to overwrite sampled input',()=>{
  expect(()=>executeStructuredText(compileStructuredText('Out := Unknown;'),{})).toThrow(/Uninitialized/);
  expect(()=>executeStructuredText(compileStructuredText('Start := FALSE;'),{Start:true})).toThrow(/overwrite/);
 });
 it('rejects unsafe or unsupported syntax without JavaScript evaluation',()=>{
  for(const source of ['WHILE TRUE DO Run := TRUE; END_WHILE;','Run := process.exit();','Run := TRUE', '(* unterminated', 'IF TRUE THEN Run := TRUE;'])expect(()=>compileStructuredText(source)).toThrow();
 });
 it('rejects dividing by zero and mixing BOOL with arithmetic',()=>{
  expect(()=>executeStructuredText(compileStructuredText('Result := 4 / (2 - 2);'),{})).toThrow(/Division by zero/);
  expect(()=>executeStructuredText(compileStructuredText('Result := TRUE + 1;'),{})).toThrow(/numeric/);
  expect(()=>executeStructuredText(compileStructuredText('Result := 2 AND TRUE;'),{})).toThrow(/BOOL/);
 });
 it('bounds source, statements and execution scans',()=>{
  expect(()=>compileStructuredText('X := 1;'.repeat(202))).toThrow(/Statement limit/);
  expect(()=>compileStructuredText(' '.repeat(12001))).toThrow(/12,000/);
  const p=compileStructuredText('Out := In;');
  expect(()=>runStructuredTextScans(p,[{scans:5001,inputs:{In:true}}])).toThrow(/5,000/);
 });
 it('deterministically replays a retained output',()=>{
  const p=compileStructuredText('IF Start THEN Run := TRUE; END_IF; IF Stop THEN Run := FALSE; END_IF;');
  const steps:{scans:number;inputs:Record<string,boolean>}[]=[{scans:2,inputs:{Start:true,Stop:false}},{scans:2,inputs:{Start:false}},{scans:1,inputs:{Stop:true}}];
  const a=runStructuredTextScans(p,steps,{Run:false});const b=runStructuredTextScans(p,steps,{Run:false});
  expect(a).toEqual(b);expect(a.rows.map(x=>x.outputs.Run)).toEqual([true,true,true,true,false]);
 });
 it('does not mutate inputs or previous state and reports assigned outputs',()=>{
  const p=compileStructuredText('Out := In + 1;');const inputs={In:12};const prev={Out:11};
  expect(executeStructuredText(p,inputs,prev).outputs.Out).toBe(13);expect(inputs.In).toBe(12);expect(prev.Out).toBe(11);
  expect(p.referencedInputs).toEqual(['In']);expect(p.assignedOutputs).toEqual(['Out']);
 });
});