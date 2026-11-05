import {describe,it,expect} from 'vitest';
import {compileStructuredText,executeStructuredText,runStructuredTextScans} from '../src/engineering/structured-text';
import {exportPlcopenStructuredText,importPlcopenStructuredText,PLCOPEN_XML_NAMESPACE} from '../src/engineering/plcopen-st-xml';
const source="VAR_INPUT\n Start : BOOL;\n Stop : BOOL;\nEND_VAR\nVAR_OUTPUT\n Sum : DINT := 0;\n Run : BOOL := FALSE;\nEND_VAR\nVAR\n Counter : INT := 0;\n Reading : LREAL := 0.25;\nEND_VAR\nFOR Counter := 1 TO 4 DO\n Sum := Sum + Counter;\nEND_FOR;\nCASE Sum OF\n 10: Run := Start AND NOT Stop;\n ELSE Run := FALSE;\nEND_CASE;\nReading := Reading + 0.5;\n";
describe('bounded IEC-oriented ST case, for and wider types',()=>{
 it('runs typed DINT, LREAL, finite FOR and CASE deterministically across scans',()=>{
  const p=compileStructuredText(source);
  expect(p.declarations.map(d=>d.type)).toEqual(['BOOL','BOOL','DINT','BOOL','INT','LREAL']);
  const a=executeStructuredText(p,{Start:true,Stop:false});
  expect(a.outputs).toEqual({Sum:10,Run:true});
  expect(a.memory.Counter).toBe(4);expect(a.memory.Reading).toBe(0.75);
  const b=executeStructuredText(p,{Start:false,Stop:false},a.memory);
  expect(b.outputs).toEqual({Sum:20,Run:false});
  expect(b.memory.Reading).toBe(1.25);
  expect(p.bodySource.startsWith('FOR')).toBe(true);
 });
 it('supports signed integer CASE labels, BOOL CASE and reverse FOR loops',()=>{
  const s='VAR_OUTPUT\n Result : DINT := 0;\nEND_VAR\nVAR\n i : INT := 0;\n Flag : BOOL := FALSE;\nEND_VAR\nFOR i := 3 TO 1 BY -1 DO\n Result := Result + i;\nEND_FOR;\nCASE Flag OF\n FALSE: Result := Result + 2;\n TRUE: Result := Result - 1;\nEND_CASE;';
  expect(executeStructuredText(compileStructuredText(s),{}).outputs.Result).toBe(8);
  const neg='VAR_OUTPUT\n Flag : BOOL := FALSE;\nEND_VAR\nCASE -2 OF\n -2: Flag := TRUE;\n ELSE Flag := FALSE;\nEND_CASE;';
  expect(executeStructuredText(compileStructuredText(neg),{}).outputs.Flag).toBe(true);
 });
 it('rejects DINT overflow and fractional initializers',()=>{
  expect(()=>executeStructuredText(compileStructuredText('VAR_OUTPUT\n Total : DINT := 2147483647;\nEND_VAR\nTotal := Total + 1;'),{})).toThrow(/DINT/);
  expect(()=>compileStructuredText('VAR_OUTPUT\n Total : DINT := 0.5;\nEND_VAR\nTotal := 0;')).toThrow(/DINT/);
  expect(()=>compileStructuredText('VAR_OUTPUT\n Total : DINT := 2147483648;\nEND_VAR\nTotal := 1;')).toThrow(/DINT/);
 });
 it('rejects unbounded FOR, zero BY and writing VAR_INPUT counters',()=>{
  const base='VAR_OUTPUT\n Total : INT := 0;\nEND_VAR\nVAR\n i : INT := 0;\nEND_VAR\n';
  expect(()=>executeStructuredText(compileStructuredText(base+'FOR i := 1 TO 999 DO Total := Total + i; END_FOR;'),{})).toThrow(/budget/);
  expect(()=>executeStructuredText(compileStructuredText(base+'FOR i := 1 TO 3 BY 0 DO Total := Total + 1; END_FOR;'),{})).toThrow(/FOR bounds/);
  expect(()=>compileStructuredText('VAR_INPUT\n i : INT;\nEND_VAR\nVAR_OUTPUT\n Out : INT;\nEND_VAR\nFOR i := 1 TO 2 DO Out := i; END_FOR;')).toThrow(/VAR_INPUT/);
 });
 it('rejects duplicated CASE arms and unsupported types',()=>{
  expect(()=>compileStructuredText('VAR_OUTPUT\n X : INT;\nEND_VAR\nCASE 1 OF 1: X := 1; 1: X := 2; END_CASE;')).toThrow(/Duplicate CASE/);
  expect(()=>compileStructuredText('VAR_OUTPUT\n X : STRING;\nEND_VAR\nX := 1;')).toThrow(/Unsupported variable type/);
 });
});
describe('PLCopen XML 2.01 ST subset interchange',()=>{
 it('round-trips typed ST POU with retaining memory and identical executed outputs',()=>{
  const xml=exportPlcopenStructuredText(source,'CommissioningPOU');
  expect(xml).toContain(PLCOPEN_XML_NAMESPACE);expect(xml).toContain('pouType="program"');
  expect(xml).toContain('<DINT/>');expect(xml).toContain('<LREAL/>');
  const imported=importPlcopenStructuredText(xml);
  expect(imported.name).toBe('CommissioningPOU');
  const steps=[{scans:3,inputs:{Start:true,Stop:false}}];
  const original=runStructuredTextScans(compileStructuredText(source),steps);
  const actual=runStructuredTextScans(compileStructuredText(imported.source),steps);
  expect(actual).toEqual(original);
  expect(exportPlcopenStructuredText(imported.source,'CommissioningPOU')).toBe(xml);
 });
 it('preserves XML reserved characters in teaching program comments and expressions',()=>{
  const s='(* Fuel & pump <permit> *)\nIF Level <= 4 THEN\n Run := TRUE;\nELSE\n Run := FALSE;\nEND_IF;';
  const xml=exportPlcopenStructuredText(s);
  expect(xml).toContain('&amp;');expect(xml).toContain('&lt;');
  const result=importPlcopenStructuredText(xml);
  expect(executeStructuredText(compileStructuredText(result.source),{Level:3}).outputs.Run).toBe(true);
 });
 it('rejects external entities, namespace mismatch, more than one POU and graphical body',()=>{
  const xml=exportPlcopenStructuredText('IF Start THEN Run := TRUE; END_IF;');
  expect(()=>importPlcopenStructuredText('<!DOCTYPE x>'+xml)).toThrow();
  expect(()=>importPlcopenStructuredText(xml.replace('tc6_0201','tc6_0200'))).toThrow(/namespace/);
  expect(()=>importPlcopenStructuredText(xml.replace('<body><ST>','<body><LD>'))).toThrow();
  expect(()=>importPlcopenStructuredText(xml.replace('</pous>','<pou name="other" pouType="program"></pou></pous>'))).toThrow();
  expect(()=>importPlcopenStructuredText(xml.replace('<xhtml:p>','<xhtml:p><script>alert(1)</script>'))).toThrow();
 });
 it('rejects invalid variables, malformed closing tags and oversized input',()=>{
  const xml=exportPlcopenStructuredText(source);
  expect(()=>importPlcopenStructuredText(xml.replace('<DINT/>','<STRING/>'))).toThrow(/Unsupported XML variable type/);
  expect(()=>importPlcopenStructuredText(xml.replace('</project>',''))).toThrow(/Unbalanced/);
  expect(()=>importPlcopenStructuredText('x'.repeat(150001))).toThrow(/150 KB/);
 });
});
