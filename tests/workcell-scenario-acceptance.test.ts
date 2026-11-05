import {describe,it,expect} from 'vitest';
import {runScenarioAcceptance} from '../src/engineering/workcell-scenario-acceptance';
import {WORKCELL_PRESETS,loadWorkcellPreset} from '../src/engineering/workcell-presets';
import type {LadderDocument} from '../src/engineering/ladder';
describe('virtual factory current-scene commissioning acceptance',()=>{
 it('all four complete reference scenes pass deterministic FAT from executed PLC and device states',()=>{
  for(const p of WORKCELL_PRESETS){
   const report=runScenarioAcceptance(p.id);
   expect(report.passed,p.title).toBe(true);
   expect(report.checks).toHaveLength(9);
   expect(report.checks.every(c=>c.passed)).toBe(true);
   expect(report.scanCount).toBe(6);
   expect(report.simulatedMs).toBe(600);
   expect(report.trace).toHaveLength(6);
   expect(report.trace.map(e=>e.timeMs)).toEqual([100,200,300,400,500,600]);
   expect(report.checks.find(c=>c.id==='guard')?.passed).toBe(true);
   expect(report.checks.find(c=>c.id==='estop')?.passed).toBe(true);
   expect(report.checks.find(c=>c.id==='replay')?.passed).toBe(true);
  }
 });
 it('FAT assesses current edited program rather than silently replacing it with the reference',()=>{
  const source=loadWorkcellPreset('packaging-cell');
  const broken:LadderDocument={...source.program,rungs:source.program.rungs.map(r=>({...r,elements:[{type:'contact' as const,tag:'AutoEnable',normallyClosed:true}]}))};
  const result=runScenarioAcceptance('packaging-cell',{layout:source.layout,program:broken});
  expect(result.passed).toBe(false);
  expect(result.checks.find(c=>c.id==='detect')?.passed).toBe(false);
  expect(result.title).toBe('Packaging cell');
 });
 it('FAT detects an unbound output and reports failed machine binding even if all coils otherwise test',()=>{
  const source=loadWorkcellPreset('vertical-transfer');
  const unbound:LadderDocument={...source.program,rungs:source.program.rungs.map((r,i)=>({...r,coil:'Unknown'+i+'_CMD'}))};
  const result=runScenarioAcceptance('vertical-transfer',{layout:source.layout,program:unbound});
  expect(result.passed).toBe(false);
  expect(result.checks.find(x=>x.id==='bindings')?.passed).toBe(false);
 });
 it('rejects malformed edited programs without claiming a safe commissioning pass',()=>{
  const p=loadWorkcellPreset('process-skid');
  const bad:LadderDocument={...p.program,rungs:[]};
  expect(()=>runScenarioAcceptance('process-skid',{layout:p.layout,program:bad})).toThrow(/Invalid current PLC program/);
 });
 it('rejects edited scenes lacking an instrumented detection sensor',()=>{
  const p=loadWorkcellPreset('vertical-transfer');
  expect(()=>runScenarioAcceptance('vertical-transfer',{layout:{...p.layout,equipment:p.layout.equipment.filter(x=>x.kind!=='photoeye')},program:p.program})).toThrow(/requires a field detection sensor/);
 });
 it('reports stable immutable evidence and an actual guard/E-stop lockout',()=>{
  const a=runScenarioAcceptance('process-skid');
  const b=runScenarioAcceptance('process-skid');
  expect(a).toEqual(b);
  expect(a.trace[2].coils.TK4_CMD).toBe(false);
  expect(a.trace[2].feedback.TK4_ACTIVE).toBe(false);
  expect(a.trace[4].feedback.PM4_ACTIVE).toBe(false);
 });
});
