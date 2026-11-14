import {describe,it,expect} from 'vitest';
import {p16ReferenceProject} from './fixtures/p16-autonomous-programs';
import {createWorld,tick} from '../src/sim/orchestrator';
import {beltConveyor} from '../src/plant/equipment/transport';
import {ctxOf,initial} from '../src/plant/world/equipment';
import {freshWorld} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import {p18Preflight,runP18JamRecovery} from '../src/plant/scenes/matrix-p18';
import type {ProjectFile,Wire} from '../src/sim/signals';

export function p18ReferenceProject(mode:'correct'|'no-reset'|'held-reset'='correct'):ProjectFile{
 const p=p16ReferenceProject('bottle-line');
 if(!p.stSource)throw new Error('P18 teacher PLC Structured Text source missing');
 let source=p.stSource;
 const replacements:[string,string][]=[
  [' In5 : BOOL;\nEND_VAR',' In5 : BOOL;\n In6 : BOOL;\n In7 : BOOL;\nEND_VAR'],
  [' Out3 : BOOL;\nEND_VAR',' Out3 : BOOL;\n Out4 : BOOL;\nEND_VAR'],
  ['Out3 := FALSE;',
   'Out3 := FALSE;\nOut4 := '+(mode==='correct'?'In6 AND In7':
    mode==='no-reset'?'FALSE':'TRUE')+';'],
 ];
 for(const [a,b] of replacements){
  if(source.split(a).length!==2)throw new Error('P18 source anchor missing '+a);
  source=source.replace(a,b);
 }
 const added:[string,string][]=[
  ['scene-plc.Q0.4','belt.CMD_resetJam+'],
  ['belt.OUT_jam','scene-plc.I0.6'],
  ['scene-supply.P24','belt.L+'],
  ['scene-supply.M0','belt.M'],
 ];
 const wires:Wire[]=[...p.wires,...added.map(([from,to],i)=>({
  id:'p18-recovery-wire-'+i,from,to,
 }))];
 const project:ProjectFile={...p,language:'st',stSource:source,wires,
  params:{...p.params,belt:{...p.params?.belt,jamResetMode:1}}};
 const world=tick(createWorld(),[{k:'loadProject',project}]).world;
 if(world.lastError)throw new Error('P18 PLC fixture rejected '+world.lastError);
 return world.project;
}
describe('P18 physical jam latch and powered reset interlock',()=>{
 it('a held reset during jam cannot bypass repair, but a new post-repair edge clears the latch',()=>{
  const ctx=ctxOf({id:'belt',kind:'belt-conveyor',originMm:vec(0,0,0),
   yawDeg:0,params:{jamResetMode:1}});
  let s=initial({}),world=freshWorld();
  let r=beltConveyor.step(s,world,{run:true,resetJam:true},10,'belt-jammed',ctx);
  s=r.state;world=r.world;
  expect(s.stalled).toBe(true);
  expect(beltConveyor.read(s,world,ctx).jam).toBe(true);
  expect(beltConveyor.read(s,world,ctx).moving).toBe(false);
  // Defective controller held the reset coil during fault — not an edge.
  r=beltConveyor.step(s,world,{run:true,resetJam:true},10,null,ctx);
  s=r.state;
  expect(s.stalled).toBe(true);
  expect(s.speedMmS).toBe(0);
  r=beltConveyor.step(s,world,{run:true,resetJam:false},10,null,ctx);
  s=r.state;
  expect(s.stalled).toBe(true);
  r=beltConveyor.step(s,world,{run:true,resetJam:true},10,null,ctx);
  expect(r.state.stalled).toBe(false);
  expect(r.state.engaged).toBe(true);
  expect(r.state.speedMmS).toBeGreaterThan(0);
 });
 it('an unrepaired jam cannot clear with arbitrary output pulses; legacy mode still uses its older latch',()=>{
  const ctx=ctxOf({id:'belt',kind:'belt-conveyor',originMm:vec(0,0,0),
   yawDeg:0,params:{jamResetMode:1}});
  let s=initial({}),world=freshWorld();
  for(const resetJam of [true,false,true,false,true]){
   const out=beltConveyor.step(s,world,{run:true,resetJam},10,'belt-jammed',ctx);
   s=out.state;expect(s.stalled).toBe(true);
   expect(s.engaged).toBe(false);
  }
  const legacy=ctxOf({id:'belt',kind:'belt-conveyor',originMm:vec(0,0,0),
   yawDeg:0,params:{jamResetMode:0}});
  const still=beltConveyor.step(s,world,{run:true,resetJam:true},10,null,legacy);
  expect(still.state.stalled).toBe(true);
 });
 it.each([[1,1],[2,42],[3,65535]] as const)(
  'same real PLC recovers seeded bottle %i after belt fault, repair and genuine acknowledgement',
  (faultAtProduct,materialSeed)=>{
   const p=p18ReferenceProject(),old=JSON.stringify(p);
   expect(p18Preflight(p,'bottle-line')).toEqual([]);
   const result=runP18JamRecovery(p,'bottle-line',{faultAtProduct,materialSeed});
   expect(result.status,JSON.stringify(result,null,2)).toBe('passed');
   expect(result.faultAtProduct).toBe(faultAtProduct);
   expect(result.materialSeed).toBe(materialSeed);
   expect(result.produced).toBe(3);
   expect(result.completed).toBe(3);
   expect(result.jammedBodyId).toBe('b'+faultAtProduct);
   expect(result.jamMeasured).toBe(true);
   expect(result.latchedAfterRepair).toBe(true);
   expect(result.resetFromPlc).toBe(true);
   expect(result.recoveredSameBody).toBe(true);
   expect(result.cases.every(c=>c.pass)).toBe(true);
   expect(result.productTrace.map(t=>t.bodyId)).toEqual(['b1','b2','b3']);
   expect(result.productTrace.every(t=>t.qualityPassed&&t.capped&&
    t.filledMl!==null&&t.filledMl>=500)).toBe(true);
   expect(result.modelThroughputPerHour).toBeGreaterThan(0);
   expect(JSON.stringify(p)).toBe(old);
   expect(old).not.toContain('p18-maintenance-ack');
  },120000);
 it('identical source, seed and fault position replay exactly original body outcomes',()=>{
  const p=p18ReferenceProject();
  const a=runP18JamRecovery(p,'bottle-line',{faultAtProduct:2,materialSeed:42});
  const b=runP18JamRecovery(p,'bottle-line',{faultAtProduct:2,materialSeed:42});
  expect(a.status).toBe('passed');
  expect(a).toEqual(b);
 },120000);
 it('real missing acknowledgement, permanently-on reset, or wrong PLC script never passes',()=>{
  for(const kind of ['no-reset','held-reset'] as const){
   const p=p18ReferenceProject(kind);
   const result=runP18JamRecovery(p,'bottle-line');
   expect(result.status,JSON.stringify(result.cases)).toBe('failed');
   expect(result.cases.every(c=>c.pass)).toBe(false);
  }
  const p=p18ReferenceProject();
  const altered={...p,stSource:p.stSource!.replace(
   'IF In0 THEN Phase := 1; END_IF;','IF FALSE THEN Phase := 1; END_IF;')};
  expect(runP18JamRecovery(altered,'bottle-line').status).toBe('failed');
 },120000);
 it('missing physical jam sensor, reset output, or maintenance mode fails closed',()=>{
  const p=p18ReferenceProject();
  const cases=[
   {...p,wires:p.wires.filter(w=>w.from!=='belt.OUT_jam')},
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.4')},
   {...p,params:{...p.params,belt:{...p.params?.belt,jamResetMode:0}}},
   {...p,wires:[...p.wires,{id:'p18-illegal',from:'scene-supply.P24',
    to:'scene-plc.I0.7'}]},
  ];
  for(const candidate of cases){
   const result=runP18JamRecovery(candidate,'bottle-line');
   expect(result.status).toBe('blocked');
   expect(result.cases).toEqual([]);
  }
  for(const value of [0,-1,4,1.25]){
   expect(runP18JamRecovery(p,'bottle-line',{faultAtProduct:value}).status).toBe('blocked');
  }
  for(const value of [0,-5,4294967296,NaN]){
   expect(runP18JamRecovery(p,'bottle-line',{materialSeed:value}).status).toBe('blocked');
  }
  expect(runP18JamRecovery(p,'robot-sort').status).toBe('blocked');
 });
});
