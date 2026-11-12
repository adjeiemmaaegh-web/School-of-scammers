import {describe,expect,it} from 'vitest';
import {createWorld,tick} from '../src/sim/orchestrator';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';
import {P14_ADVANCED_SPECS,advancedSpecFor} from '../src/plant/scenes/matrix-p14';
import {runP15Batch} from '../src/plant/scenes/matrix-p15';
import {capper} from '../src/plant/equipment/process';
import {ctxOf,initial} from '../src/plant/world/equipment';
import {freshWorld,spawnBody} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import type {ProjectFile,Wire} from '../src/sim/signals';

const plc=(source:string)=>[
 'VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',' In2 : BOOL;',' In3 : BOOL;',
 'END_VAR','VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',
 ' Out2 : BOOL;',' Out3 : BOOL;','END_VAR',source,
].join('\n');
const correct=plc('Out0 := In0; Out1 := In1; Out2 := In2; Out3 := In3;');
function prepared(id:string):ProjectFile{
 const spec=advancedSpecFor(id)!;
 const raw=makePlantSceneProject(id);
 const ends:[string,string][]=[
  ['scene-supply.P24','scene-plc.L+'],
  ['scene-supply.M0','scene-plc.M'],
 ];
 spec.commands.forEach(({actor,command},i)=>{
  ends.push(['scene-plc.Q0.'+i,actor+'.CMD_'+command+'+'],
   ['scene-supply.M0',actor+'.M-']);
 });
 const wires:Wire[]=ends.map(([from,to],i)=>({id:'p15w'+i,from,to}));
 const project={...raw,wires,language:'st' as const,stSource:correct};
 const loaded=tick(createWorld(),[{k:'loadProject',project}]).world;
 expect(loaded.lastError,id).toBeNull();
 return loaded.project;
}
describe('P15 real repeated-production trials and conservation',()=>{
 it.each(P14_ADVANCED_SPECS.map(s=>s.sceneId))(
  '%s runs consecutive physical products through authentic 24V PLC and worker commands',
  id=>{
   const project=prepared(id),before=JSON.stringify(project);
   const a=runP15Batch(project,id);
   expect(a.status,id+JSON.stringify(a.cases)).toBe('passed');
   expect(a.verifiedProducts,id).toBe(id==='palletizing'?4:3);
   expect(a.expectedProducts).toBe(a.verifiedProducts);
   expect(a.cases.every(c=>c.pass)).toBe(true);
   expect(a.cases.length).toBe(id==='palletizing'?6:4);
   expect(a.executedScans).toBeGreaterThan(30);
   expect(a.executedScans).toBeLessThan(2000);
   expect(JSON.stringify(project)).toBe(before);
   expect(before).not.toContain('p15-batch-switch-');
   expect(before).not.toContain('verifiedProducts');
  });
 it.each(P14_ADVANCED_SPECS.map(s=>s.sceneId))(
  '%s rejects incorrect always-energized or always-deenergized control',
  id=>{
   const project=prepared(id);
   const on=runP15Batch({...project,stSource:plc(
    'Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Out3 := TRUE;')},id);
   const off=runP15Batch({...project,stSource:plc(
    'Out0 := FALSE; Out1 := FALSE; Out2 := FALSE; Out3 := FALSE;')},id);
   expect(on.status).toBe('failed');
   expect(on.cases[0]?.id).toBe('idle');
   expect(on.cases[0]?.pass).toBe(false);
   expect(off.status).toBe('failed');
   expect(off.verifiedProducts).toBe(0);
  });
 it('refuses fabricated bypass of output wiring, physical machines and pre-existing faults',()=>{
  const p=prepared('palletizing');
  const faulty={...p,plantFaults:{palletizer:'pattern-jam'}};
  const missing={...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.1')};
  const fake={...p,components:[...p.components,
   {id:'p15-batch-switch-0',kind:'start' as const,x:0,y:0,pressed:false}]};
  for(const bad of [faulty,missing,fake]){
   const r=runP15Batch(bad,'palletizing');
   expect(r.status).toBe('blocked');
   expect(r.cases).toHaveLength(0);
  }
 });
 it('capper dwell is per genuine bottle, never inherited from a previous body',()=>{
  const ctx=ctxOf({id:'capper',kind:'capper',originMm:vec(0,0,0),
   yawDeg:0,params:{dwellMs:800,requiresFilled:1,minFillMl:500}});
  let w=spawnBody(freshWorld(),'feeder',{shape:'cylinder',size:vec(90,90,190),
   massKg:8,pos:vec(0,0,120),tags:{filledMl:500}});
  let state=initial({});
  for(let i=0;i<79;i++){
   const next=capper.step(state,w,{cap:true},10,null,ctx);
   state=next.state;w=next.world;
  }
  expect(w.bodies[0].tags.capped).not.toBe(true);
  // Move the first manufactured bottle out of the capper's reach. The
  // second is a new actual spawn, not an edited copy of its identity.
  w={...w,bodies:w.bodies.map(b=>({...b,pos:vec(1000,0,120)}))};
  w=spawnBody(w,'feeder',{shape:'cylinder',size:vec(90,90,190),
   massKg:8,pos:vec(0,0,120),tags:{filledMl:500}});
  let next=capper.step(state,w,{cap:true},10,null,ctx);
  state=next.state;w=next.world;
  expect(w.bodies[1].tags.capped).not.toBe(true);
  expect(state.elapsedMs).toBe(10);
  expect(state.activeBodyId).toBe(w.bodies[1].id);
  for(let i=0;i<79;i++){
   next=capper.step(state,w,{cap:true},10,null,ctx);
   state=next.state;w=next.world;
  }
  expect(w.bodies[1].tags.capped).toBe(true);
  expect(w.bodies[0].tags.capped).not.toBe(true);
  next=capper.step(state,w,{cap:true},10,null,ctx);
  expect(next.state.elapsedMs).toBe(0);
 });
});
