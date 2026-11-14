import {describe,expect,it} from 'vitest';
import {createWorld,tick} from '../src/sim/orchestrator';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';
import {SCENES} from '../src/plant/scenes/catalogue';
import {P12_MATRIX_SPECS,matrixSpecFor} from '../src/plant/scenes/matrix';
import {expandedPreflight,expandedSpecFor,P13_SPECS,P13_UNSUPPORTED,
 runExpandedMatrix,validateP13Specs} from '../src/plant/scenes/matrix-p13';
import type {ProjectFile,Wire} from '../src/sim/signals';

const st=(logic:string)=>['VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',
 'END_VAR','VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',
 'END_VAR',logic].join('\n');
const all=(sceneId:string):ProjectFile=>{
 const spec=expandedSpecFor(sceneId)!;
 const base=makePlantSceneProject(sceneId);
 const wires:Wire[]=[
  {id:'ps1',from:'scene-supply.P24',to:'scene-plc.L+'},
  {id:'ps2',from:'scene-supply.M0',to:'scene-plc.M'},
  {id:'ps3',from:'scene-plc.Q0.0',to:spec.actor+'.CMD_'+spec.command+'+'},
  {id:'ps4',from:'scene-supply.M0',to:spec.actor+'.M-'},
 ];
 if(spec.inputSensor){
  const sensor=spec.inputSensor.split('.')[0];
  wires.push(
   {id:'ps5',from:spec.inputSensor,to:'scene-plc.I0.0'},
   {id:'ps6',from:'scene-supply.P24',to:sensor+'.L+'},
   {id:'ps7',from:'scene-supply.M0',to:sensor+'.M'},
  );
 }
 const project={...base,wires,language:'st' as const,stSource:st(
  'Out0 := In0; Out1 := FALSE;')};
 const w=tick(createWorld(),[{k:'loadProject',project}]).world;
 expect(w.lastError).toBeNull();
 return w.project;
};
describe('P13: honest remaining factory scene multi-case actuator validation',()=>{
 it('covers all 21 scene IDs with P12 six, P13 eleven, and four explicit unsupported complete-process workcells',()=>{
  expect(()=>validateP13Specs()).not.toThrow();
  const p12=new Set(P12_MATRIX_SPECS.map(s=>s.sceneId));
  const p13=new Set(P13_SPECS.map(s=>s.sceneId));
  const blocked=Object.keys(P13_UNSUPPORTED);
  expect(p12.size).toBe(6);
  expect(p13.size).toBe(11);
  expect(blocked).toHaveLength(4);
  for(const scene of SCENES){
   const coverage=Number(p12.has(scene.id))+Number(p13.has(scene.id))+
    Number(blocked.includes(scene.id));
   expect(coverage,scene.id).toBe(1);
  }
  expect(SCENES).toHaveLength(21);
  expect(expandedPreflight(makePlantSceneProject('bottle-line'),'bottle-line'))
   .toEqual([expect.stringContaining('cylinder bottle')]);
  expect(matrixSpecFor('sorting-line')).toBeUndefined();
 });
 it.each(P13_SPECS.map(spec=>[spec.sceneId,spec] as const))(
  '%s: actual wired PLC output and plant model pass four independent demand, release and fault-repair cases',
  (id,spec)=>{
   const project=all(id);
   expect(expandedPreflight(project,id)).toEqual([]);
   const saved=JSON.stringify(project);
   const a=runExpandedMatrix(project,id);
   expect(a.status,JSON.stringify(a.cases,null,2)).toBe('passed');
   expect(a.cases).toHaveLength(4);
   expect(a.cases.map(c=>c.id)).toEqual([
    'idle','demand','release','fault-recovery',
   ]);
   expect(a.cases.every(c=>c.pass)).toBe(true);
   expect(a.cases.every(c=>c.atMs>0)).toBe(true);
   expect(a.executedScans).toBeGreaterThan(10);
   expect(a.executedScans).toBeLessThanOrEqual(2000);
   expect(JSON.stringify(project)).toBe(saved);
   const repeat=runExpandedMatrix(project,id);
   expect(repeat).toEqual(a);
   if(spec.kind==='crane')
    expect(a.diagnostic).toMatch(/no inventory transfer claim|real storage deferred/);
  },
 );
 it.each(P13_SPECS.map(spec=>[spec.sceneId] as const))(
  '%s: wrong always-on and never-on PLC logic cannot earn a pass',
  id=>{
   const good=all(id);
   const on={...good,stSource:st('Out0 := TRUE; Out1 := FALSE;')};
   const off={...good,stSource:st('Out0 := FALSE; Out1 := FALSE;')};
   const a=runExpandedMatrix(on,id),b=runExpandedMatrix(off,id);
   expect(a.status,'always-on '+id).toBe('failed');
   expect(a.cases.find(c=>c.id==='idle')?.pass).toBe(false);
   expect(b.status,'always-off '+id).toBe('failed');
   expect(b.cases.find(c=>c.id==='demand')?.pass).toBe(false);
  },
 );
 it('rejects broken source sensor patch, missing PLC output, user faults, fixture injection',()=>{
  const id='sorting-line',good=all(id);
  const noInput={...good,wires:good.wires.filter(w=>w.from!=='eye1.OUT_present')};
  const noOutput={...good,wires:good.wires.filter(w=>w.from!=='scene-plc.Q0.0')};
  const faults={...good,plantFaults:{gate:'gate-jammed'}};
  const colliding={...good,components:[...good.components,
   {id:'p13-trial-switch',kind:'start' as const,x:0,y:0,pressed:false}]};
  for(const bad of [noInput,noOutput,faults,colliding]){
   const result=runExpandedMatrix(bad,id);
   expect(result.status).toBe('blocked');
   expect(result.cases).toHaveLength(0);
   expect(result.diagnostic.length).toBeGreaterThan(12);
  }
 });
 it('physical AS/RS crane cannot silently advance to a bay with no PLC command',()=>{
  const project=makePlantSceneProject('mini-warehouse');
  let w=tick(createWorld(),[{k:'loadProject',project},{k:'run'}]).world;
  expect(w.lastError).toBeNull();
  for(let i=0;i<80;i++)w=tick(w).world;
  expect(w.lastError).toBeNull();
  expect(w.plantWorld.signals.crane.atBay).toBe(0);
  expect(w.plantWorld.signals.crane.busy).toBe(false);
  expect(w.plantWorld.signals.crane.storedCount).toBe(0);
 });
 it('P13 does not treat preliminary crane bay arrival as a successful physical inventory transfer',()=>{
  for(const id of ['mini-warehouse','robot-warehouse-receiving']){
   const result=runExpandedMatrix(all(id),id);
   expect(result.status,JSON.stringify(result.cases)).toBe('passed');
   expect(result.diagnostic).toMatch(/inventory transfer claim|real storage deferred/);
   expect(result.diagnostic).not.toMatch(/stored item|retrieved item|inventory passed/);
  }
 });
});
