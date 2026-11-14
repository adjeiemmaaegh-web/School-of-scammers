import {describe,expect,it} from 'vitest';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';
import {createWorld,tick} from '../src/sim/orchestrator';
import {P12_MATRIX_SPECS,matrixPreflight,matrixSpecFor,runPlantMatrix,
 type MatrixSpec} from '../src/plant/scenes/matrix';
import type {ProjectFile,Wire} from '../src/sim/signals';

const source=(body:string)=>[
 'VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;','END_VAR',body,
].join('\n');
const logic=(spec:MatrixSpec)=>spec.kind==='guard'?
 'Out0 := NOT In0; Out1 := In0;':
 spec.kind==='lift'||spec.kind==='index'?
 'Out0 := In0 AND NOT In1; Out1 := FALSE;':
 'Out0 := In0; Out1 := FALSE;';
const add=(parts:[string,string][],a:string,b:string)=>parts.push([a,b]);
export function workingMatrixProject(spec:MatrixSpec):ProjectFile{
 const base=makePlantSceneProject(spec.sceneId);
 const parts:[string,string][]=[
  ['scene-supply.P24','scene-plc.L+'],
  ['scene-supply.M0','scene-plc.M'],
  ['scene-supply.M0',spec.actor+'.M-'],
 ];
 if(spec.kind==='guard'){
  add(parts,'scene-plc.Q0.0','belt.CMD_run+');
  add(parts,'scene-plc.Q0.1',spec.actor+'.CMD_'+spec.command+'+');
  add(parts,'scene-supply.M0','belt.M-');
 }else add(parts,'scene-plc.Q0.0',spec.actor+'.CMD_'+spec.command+'+');
 if(spec.inputSensor){
  add(parts,spec.inputSensor,'scene-plc.I0.0');
  const sensor=spec.inputSensor.split('.')[0];
  add(parts,'scene-supply.P24',sensor+'.L+');
  add(parts,'scene-supply.M0',sensor+'.M');
 }
 if(spec.feedback){
  add(parts,spec.feedback,'scene-plc.I0.1');
  add(parts,'scene-supply.P24',spec.actor+'.L+');
  add(parts,'scene-supply.M0',spec.actor+'.M');
 }
 const wires:Wire[]=parts.map(([from,to],i)=>({id:'p12w'+(i+1),from,to}));
 const project:ProjectFile={...base,wires,language:'st',stSource:source(logic(spec))};
 const valid=tick(createWorld(),[{k:'loadProject',project}]).world;
 expect(valid.lastError).toBeNull();
 return valid.project;
}
describe('P12 real PLC factory multi-case matrices',()=>{
 it('explicitly calibrates six original scenes without manufacturing coverage for other fifteen',()=>{
  expect(P12_MATRIX_SPECS).toHaveLength(6);
  expect(new Set(P12_MATRIX_SPECS.map(s=>s.sceneId)).size).toBe(6);
  expect(matrixSpecFor('sorting-line')).toBeUndefined();
  expect(runPlantMatrix(makePlantSceneProject('sorting-line'),'sorting-line').status)
   .toBe('blocked');
 });
 it.each(P12_MATRIX_SPECS.map(spec=>[spec.sceneId,spec] as const))(
  '%s: correct ST drives real 24V pushbutton, machine, interlock, stops and fault recovery',
  (_id,spec)=>{
   const project=workingMatrixProject(spec);
   expect(matrixPreflight(project,spec.sceneId)).toEqual([]);
   const unchanged=JSON.stringify(project);
   const first=runPlantMatrix(project,spec.sceneId);
   expect(first.status,JSON.stringify(first.cases,null,2)).toBe('passed');
   expect(first.cases.map(x=>x.id)).toEqual([
    'idle','demand','release','fault-recovery',
   ]);
   expect(first.cases.every(x=>x.pass)).toBe(true);
   expect(first.cases.every(x=>x.atMs>0)).toBe(true);
   expect(first.executedScans).toBeGreaterThan(40);
   expect(first.executedScans).toBeLessThanOrEqual(2000);
   expect(JSON.stringify(project)).toBe(unchanged);
   const second=runPlantMatrix(project,spec.sceneId);
   expect(second).toEqual(first);
  },
 );
 it.each(P12_MATRIX_SPECS.map(spec=>[spec.sceneId,spec] as const))(
  '%s: stuck-on and stuck-off programs are rejected across independent worker inputs',
  (_id,spec)=>{
   const good=workingMatrixProject(spec);
   const alwaysOn={...good,stSource:source(
    'Out0 := TRUE; Out1 := TRUE;')};
   const alwaysOff={...good,stSource:source(
    'Out0 := FALSE; Out1 := FALSE;')};
   for(const [name,project] of [['on',alwaysOn],['off',alwaysOff]] as const){
    const result=runPlantMatrix(project,spec.sceneId);
    expect(result.status).toBe('failed');
    expect(result.cases.some(x=>!x.pass)).toBe(true);
    expect(result.cases.some(x=>x.id==='idle'&&!x.pass||
     x.id==='demand'&&!x.pass)).toBe(true);
    expect(result.diagnostic).toMatch(/independent real-worker cases failed/);
   }
  },
 );
 it('a PLC that ignores top/indexed feedback fails the active end-limit case',()=>{
  for(const sceneId of ['rotary-inspection','two-level-lift','scissor-lift-station']){
   const spec=matrixSpecFor(sceneId)!;
   const good=workingMatrixProject(spec);
   const bad={...good,stSource:source('Out0 := In0; Out1 := FALSE;')};
   const r=runPlantMatrix(bad,sceneId);
   expect(r.status).toBe('failed');
   expect(r.cases.find(c=>c.id==='demand')?.pass).toBe(false);
  }
 });
 it('rejects missing supply, missing command terminal, forged fault and digital I/O bypass',()=>{
  const spec=matrixSpecFor('rotary-inspection')!,good=workingMatrixProject(spec);
  const withoutPower={...good,wires:good.wires.filter(w=>
   w.from!=='scene-supply.P24'||w.to!=='scene-plc.L+')};
  const withoutOutput={...good,wires:good.wires.filter(w=>
   w.from!=='scene-plc.Q0.0'&&w.to!=='scene-plc.Q0.0')};
  const corrupt={...good,plantFaults:{index:'actuator-stuck'}};
  const fixtureCollision={...good,components:[...good.components,
   {id:'p12-test-button',kind:'start' as const,x:70,y:70,pressed:false}]};
  for(const p of [withoutPower,withoutOutput,corrupt,fixtureCollision]){
   const r=runPlantMatrix(p,spec.sceneId);
   expect(r.status).toBe('blocked');
   expect(r.cases).toHaveLength(0);
   expect(r.diagnostic.length).toBeGreaterThan(0);
  }
  const wrongInput={...good,wires:good.wires.filter(w=>
   w.from!=='eye.OUT_present'&&w.to!=='eye.OUT_present')};
  expect(runPlantMatrix(wrongInput,spec.sceneId).status).toBe('blocked');
 });
 it('never mutates the user project or stores test wiring/grades in an exported project',()=>{
  const good=workingMatrixProject(matrixSpecFor('guarded-conveyor')!);
  const before=JSON.stringify(good);
  const r=runPlantMatrix(good,'guarded-conveyor');
  expect(r.status).toBe('passed');
  expect(JSON.stringify(good)).toBe(before);
  expect(before).not.toContain('p12-test-button');
  expect(before).not.toContain('matrixResult');
  expect(r.cases.find(x=>x.id==='fault-recovery')?.pass).toBe(true);
 });
});
