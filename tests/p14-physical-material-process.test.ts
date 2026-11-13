import {describe,expect,it} from 'vitest';
import {createWorld,tick} from '../src/sim/orchestrator';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';
import {SCENES} from '../src/plant/scenes/catalogue';
import {P12_MATRIX_SPECS} from '../src/plant/scenes/matrix';
import {P13_SPECS} from '../src/plant/scenes/matrix-p13';
import {advancedPreflight,advancedSpecFor,P14_ADVANCED_SPECS,
 runAdvancedProcess,validateP14Specs} from '../src/plant/scenes/matrix-p14';
import type {ProjectFile,Wire} from '../src/sim/signals';

const plcSource=(logic:string)=>{
 const inputs=Array.from({length:4},(_,i)=>' In'+i+' : BOOL;');
 const outputs=Array.from({length:4},(_,i)=>' Out'+i+' : BOOL;');
 return ['VAR_INPUT',...inputs,'END_VAR','VAR_OUTPUT',...outputs,'END_VAR',logic].join('\n');
};
const goodLogic=plcSource(
 'Out0 := In0; Out1 := In1; Out2 := In2; Out3 := In3;');
export function makeP14CorrectProject(id:string):ProjectFile{
 const spec=advancedSpecFor(id)!;
 const original=makePlantSceneProject(id);
 const edges:[string,string][]=[
  ['scene-supply.P24','scene-plc.L+'],
  ['scene-supply.M0','scene-plc.M'],
 ];
 spec.commands.forEach(({actor,command},i)=>{
  edges.push(['scene-plc.Q0.'+i,actor+'.CMD_'+command+'+'],
   ['scene-supply.M0',actor+'.M-']);
 });
 const wires:Wire[]=edges.map(([from,to],i)=>({
  id:'p14w'+(i+1),from,to,
 }));
 const raw:ProjectFile={...original,wires,language:'st',stSource:goodLogic};
 const w=tick(createWorld(),[{k:'loadProject',project:raw}]).world;
 expect(w.lastError,id).toBeNull();
 return w.project;
}
describe('P14 original physical material conservation factory assessments',()=>{
 it('maps every original scene to 6 P12, 11 P13 and 4 P14 physical benchmarks without blind gaps',()=>{
  expect(()=>validateP14Specs()).not.toThrow();
  const p12=new Set(P12_MATRIX_SPECS.map(s=>s.sceneId));
  const p13=new Set(P13_SPECS.map(s=>s.sceneId));
  const p14=new Set(P14_ADVANCED_SPECS.map(s=>s.sceneId));
  expect([p12.size,p13.size,p14.size]).toEqual([6,11,4]);
  expect(SCENES).toHaveLength(21);
  for(const scene of SCENES){
   expect(Number(p12.has(scene.id))+Number(p13.has(scene.id))+
    Number(p14.has(scene.id)),scene.id).toBe(1);
  }
 });
 it.each(P14_ADVANCED_SPECS.map(s=>[s.sceneId,s] as const))(
  '%s: a correctly wired real PLC passes idle, physical product, premature release and fault-recovery',
  (id,spec)=>{
   const project=makeP14CorrectProject(id);
   expect(advancedPreflight(project,id)).toEqual([]);
   const unchanged=JSON.stringify(project);
   const a=runAdvancedProcess(project,id);
   expect(a.status,JSON.stringify(a.cases,null,2)).toBe('passed');
   expect(a.cases.map(c=>c.id)).toEqual([
    'idle','demand','release','fault-recovery',
   ]);
   expect(a.cases.every(c=>c.pass)).toBe(true);
   expect(a.cases.every(c=>c.atMs>0)).toBe(true);
   expect(a.executedScans).toBeGreaterThan(30);
   expect(a.executedScans).toBeLessThanOrEqual(2400);
   expect(JSON.stringify(project)).toBe(unchanged);
   const repeat=runAdvancedProcess(project,id);
   expect(repeat).toEqual(a);
   expect(a.diagnostic).toMatch(/not full industrial certification/);
   expect(spec.commands.length).toBeGreaterThanOrEqual(3);
  },
 );
 it.each(P14_ADVANCED_SPECS.map(s=>[s.sceneId] as const))(
  '%s: constant-ON/constant-OFF code cannot achieve a fake material-process success',
  id=>{
   const good=makeP14CorrectProject(id);
   const on={...good,stSource:plcSource(
    'Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Out3 := TRUE;')};
   const off={...good,stSource:plcSource(
    'Out0 := FALSE; Out1 := FALSE; Out2 := FALSE; Out3 := FALSE;')};
   const a=runAdvancedProcess(on,id),b=runAdvancedProcess(off,id);
   expect(a.status,id+' constant-on '+JSON.stringify(a.cases)).toBe('failed');
   expect(a.cases.find(c=>c.id==='idle')?.pass).toBe(false);
   expect(b.status,id+' constant-off '+JSON.stringify(b.cases)).toBe('failed');
   expect(b.cases.find(c=>c.id==='demand')?.pass).toBe(false);
  },
 );
 it('refuses to fabricate bodies when feeder Q output, return, PLC power or original devices are missing',()=>{
  const id='gantry-transfer',p=makeP14CorrectProject(id);
  const faults={...p,plantFaults:{gantry:'gripper-leak'}};
  const missingQ={...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.0')};
  const missingReturn={...p,wires:p.wires.filter(w=>w.to!=='gantry.M-')};
  const missingPart={...p,components:p.components.filter(c=>c.id!=='feeder')};
  const absentPower={...p,wires:p.wires.filter(w=>w.from!=='scene-supply.P24')};
  const collide={...p,components:[...p.components,
   {id:'p14-trial-0',kind:'start' as const,x:90,y:70,pressed:false}]};
  for(const bad of [faults,missingQ,missingReturn,missingPart,absentPower,collide]){
   const result=runAdvancedProcess(bad,id);
   expect(result.status).toBe('blocked');
   expect(result.cases).toHaveLength(0);
   expect(result.diagnostic.length).toBeGreaterThan(10);
  }
 });
 it('cannot substitute a box-shaped feeder or a legacy non-interlocked capper for a physical bottle process',()=>{
  const p=makeP14CorrectProject('bottle-line');
  const shape={...p,params:{...p.params,feeder:{...p.params?.feeder,shapeMode:0}}};
  const cap={...p,params:{...p.params,capper:{...p.params?.capper,requiresFilled:0}}};
  for(const bad of [shape,cap]){
   const r=runAdvancedProcess(bad,'bottle-line');
   expect(r.status).toBe('blocked');
   expect(r.cases).toHaveLength(0);
   expect(r.diagnostic).toMatch(/cylinder feeder and verified fill-before-cap/);
  }
 });
 it('the real spawned/held/palletized cargo persists in source-model geometry, not a saved grade or hidden phantom actor',()=>{
  for(const id of ['gantry-transfer','palletizing','robot-sort','bottle-line']){
   const p=makeP14CorrectProject(id),before=JSON.stringify(p);
   const r=runAdvancedProcess(p,id);
   expect(r.status,JSON.stringify(r.cases)).toBe('passed');
   expect(JSON.stringify(p)).toBe(before);
   expect(before).not.toContain('p14-trial-');
   expect(before).not.toContain('sourceSignature');
   expect(before).not.toContain('p14-simulated-body');
  }
 });
});
