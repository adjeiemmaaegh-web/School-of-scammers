import {describe,it,expect} from 'vitest';
import {compileStructuredText,executeStructuredText,runStructuredTextScans,ST_DEMO,ST_TYPED_DEMO} from '../src/engineering/structured-text';

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

 it('resolves mixed-case tag references and retains first output spelling',()=>{
  const p=compileStructuredText('IF start THEN Run := TRUE; ELSE RUN := FALSE; END_IF; result := run;');
  expect(p.referencedInputs).toEqual(['start']);
  expect(p.assignedOutputs).toEqual(['Run','result']);
  const result=executeStructuredText(p,{START:true},{rUn:false});
  expect(result.outputs).toEqual({Run:true,result:true});
  expect(result.signals.Run).toBe(true);
  expect(result.assignments.map(a=>a.tag)).toEqual(['Run','result']);
 });
 it('rejects case-only aliases and sampled-input writes through alternate spelling',()=>{
  const p=compileStructuredText('Start := FALSE;');
  expect(()=>executeStructuredText(p,{start:true})).toThrow(/overwrite/);
  expect(()=>executeStructuredText(p,{Start:true,sTaRt:false})).toThrow(/Ambiguous signal aliases/);
  expect(()=>executeStructuredText(p,{}, {Run:false,run:true})).toThrow(/Ambiguous signal aliases/);
 });
 it('replaces case-variant input names between scan steps without creating aliases',()=>{
  const p=compileStructuredText('IF start THEN Run := TRUE; ELSE run := FALSE; END_IF;');
  const result=runStructuredTextScans(p,[{scans:1,inputs:{Start:true}},{scans:1,inputs:{START:false}}]);
  expect(result.rows.map(row=>row.outputs.Run)).toEqual([true,false]);
  expect(Object.keys(result.rows[1].inputs)).toEqual(['START']);
 });
 it('implements safe integer MOD at multiplication precedence with signed remainder',()=>{
  const p=compileStructuredText('A := 2 + 7 MOD 4 * 3; B := -7 MOD 4; C := 7 MOD -4;');
  expect(executeStructuredText(p,{}).outputs).toEqual({A:11,B:-3,C:3});
  expect(executeStructuredText(compileStructuredText('R := 10 mod 3;'),{}).outputs.R).toBe(1);
 });
 it('rejects REAL, BOOL, and division-by-zero MOD operands',()=>{
  expect(()=>executeStructuredText(compileStructuredText('X := 1.5 MOD 2;'),{})).toThrow(/safe integer/);
  expect(()=>executeStructuredText(compileStructuredText('X := TRUE MOD 2;'),{})).toThrow(/numeric/);
  expect(()=>executeStructuredText(compileStructuredText('X := 4 MOD 0;'),{})).toThrow(/Division by zero/);
 });

 it('compiles typed VAR blocks and preserves private VAR memory across scans',()=>{
  const program=compileStructuredText(`VAR_INPUT Start : BOOL; END_VAR
VAR_OUTPUT Run : BOOL := FALSE; Total : INT := 0; END_VAR
VAR Internal : INT := 0; END_VAR
Internal := Internal + 1; Total := Internal; Run := Start;`);
  expect(program.declarations.map(d=>[d.name,d.type,d.scope])).toEqual([
   ['Start','BOOL','input'],['Run','BOOL','output'],['Total','INT','output'],['Internal','INT','local']
  ]);
  const first=executeStructuredText(program,{start:true});
  expect(first.outputs).toEqual({Run:true,Total:1});
  expect(first.memory).toEqual({Run:true,Total:1,Internal:1});
  expect(first.signals.Internal).toBe(1);
  const second=executeStructuredText(program,{START:false},first.memory);
  expect(second.outputs).toEqual({Run:false,Total:2});
  expect(second.memory.Internal).toBe(2);
  expect(second.outputs).not.toHaveProperty('Internal');
 });
 it('enforces BOOL, INT and REAL types on sampled inputs and assignments',()=>{
  const program=compileStructuredText(`VAR_INPUT Gate:BOOL; Scale:REAL; END_VAR
VAR_OUTPUT Count:INT:=0; END_VAR
IF Gate THEN Count:=Scale; END_IF;`);
  expect(()=>executeStructuredText(program,{Gate:1,Scale:1})).toThrow(/requires BOOL/);
  expect(()=>executeStructuredText(program,{Gate:true,Scale:true})).toThrow(/requires numeric REAL/);
  expect(()=>executeStructuredText(program,{Gate:true,Scale:2.5})).toThrow(/INT/);
  expect(executeStructuredText(program,{Gate:true,Scale:4}).outputs.Count).toBe(4);
  expect(()=>executeStructuredText(program,{Scale:4})).toThrow(/Missing VAR_INPUT/);
 });
 it('detects signed INT overflow and fractional assignments with no state mutation',()=>{
  const program=compileStructuredText(`VAR_OUTPUT Counter : INT := 32767; END_VAR Counter := Counter + 1;`);
  const previous={Counter:32767};
  expect(()=>executeStructuredText(program,{},previous)).toThrow(/-32768..32767/);
  expect(previous.Counter).toBe(32767);
  expect(()=>compileStructuredText('VAR_OUTPUT Bad : INT := 32768; END_VAR Bad := 1;')).toThrow(/-32768..32767/);
  expect(()=>compileStructuredText('VAR_OUTPUT Bad : BOOL := 1; END_VAR Bad := FALSE;')).toThrow(/requires BOOL/);
 });
 it('rejects duplicate case-folded declarations, undeclared names and input writes',()=>{
  const sources=[
   'VAR_OUTPUT Run : BOOL; run : BOOL; END_VAR Run := TRUE;',
   'VAR_OUTPUT Run : BOOL; END_VAR Run := Missing;',
   'VAR_OUTPUT Run : BOOL; END_VAR Unknown := TRUE;',
   'VAR_INPUT Start : BOOL; END_VAR VAR_OUTPUT Run : BOOL; END_VAR Start := TRUE;',
   'VAR_OUTPUT Run : BOOL; END_VAR IF Start THEN Run := TRUE; END_IF;'
  ];
  for(const s of sources)expect(()=>compileStructuredText(s)).toThrow();
 });
 it('rejects unsupported declarations and initializers instead of silently ignoring syntax',()=>{
  const sources=[
   'VAR_INPUT Start : BOOL := TRUE; END_VAR VAR_OUTPUT Run : BOOL; END_VAR Run := Start;',
   'VAR_OUTPUT Run : STRING; END_VAR Run := TRUE;',
   'VAR_OUTPUT Run : BOOL; Run : REAL; END_VAR Run := TRUE;',
   'VAR_OUTPUT Run : BOOL; END_VAR VAR Unsupported : DWORD; END_VAR Run := TRUE;',
   'VAR_OUTPUT Run : BOOL; END_VAR Run := TRUE; VAR Temp:INT; END_VAR'
  ];
  for(const s of sources)expect(()=>compileStructuredText(s)).toThrow();
 });
 it('initializes typed BOOL, INT and REAL outputs on first scan, then retains them',()=>{
  const p=compileStructuredText('VAR_OUTPUT B:BOOL; I:INT := -4; R:REAL := 2.25; END_VAR IF B THEN I:=0; END_IF;');
  const a=executeStructuredText(p,{});
  expect(a.outputs).toEqual({B:false,I:-4,R:2.25});
  const b=executeStructuredText(p,{},a.memory);
  expect(b.outputs).toEqual(a.outputs);
  expect(executeStructuredText(p,{},{}).outputs).toEqual(a.outputs);
 });
 it('replays typed private memory deterministically while reporting public outputs only',()=>{
  const program=compileStructuredText(`VAR_INPUT Start:BOOL; END_VAR
VAR_OUTPUT Pulse:BOOL:=FALSE; END_VAR
VAR Previous:BOOL:=FALSE; END_VAR
Pulse := Start AND NOT Previous;
Previous := Start;`);
  const steps=[{scans:2,inputs:{Start:true}},{scans:1,inputs:{start:false}},{scans:1,inputs:{START:true}}];
  const a=runStructuredTextScans(program,steps);
  const b=runStructuredTextScans(program,steps);
  expect(a).toEqual(b);
  expect(a.rows.map(row=>row.outputs.Pulse)).toEqual([true,false,false,true]);
  expect(a.finalOutputs).toEqual({Pulse:true,Previous:true});
 });
 it('runs the typed example with persistent counter state',()=>{
  const program=compileStructuredText(ST_TYPED_DEMO);
  const first=executeStructuredText(program,{Start:true,Stop:false});
  const second=executeStructuredText(program,{Start:false,Stop:false},first.memory);
  expect(first.outputs).toEqual({Run:true,Scans:1});
  expect(second.outputs).toEqual({Run:true,Scans:2});
  expect(second.memory.InternalCount).toBe(2);
 });
});