import {describe,expect,it} from 'vitest';
import {createWorld,tick} from '../src/sim/orchestrator';
import {makePlantSceneProject} from '../src/sim/p3-scene-import';
import {runP15AutonomousSort,autonomousSortPreflight} from '../src/plant/scenes/matrix-p15-autonomous';
import {robotArm} from '../src/plant/equipment/robot';
import {ctxOf,initial} from '../src/plant/world/equipment';
import {freshWorld,spawnBody,conserved} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import type {ProjectFile,Wire} from '../src/sim/signals';

const header=[
 'VAR_INPUT',' In0 : BOOL;',' In1 : BOOL;',' In2 : BOOL;',
 ' In3 : BOOL;',' In4 : BOOL;','END_VAR',
 'VAR_OUTPUT',' Out0 : BOOL;',' Out1 : BOOL;',' Out2 : BOOL;',
 ' Out3 : BOOL;',' Out4 : BOOL;',' Out5 : BOOL;','END_VAR',
 'VAR',' Phase : INT := 0;',' Count : INT := 0;',
 ' Lane : BOOL := FALSE;','END_VAR',
 'Out0 := FALSE; Out1 := FALSE; Out2 := FALSE; Out3 := Lane;',
 'Out4 := Phase > 0 AND Phase < 9;',
 'Out5 := Phase > 0 AND Phase < 9;',
].join('\n');
const commands=[
 'IF In0 THEN Phase := 1; END_IF;',
 'IF Count < 3 THEN Out0 := TRUE; Phase := 2; ELSE Phase := 9; END_IF;',
 'IF In1 THEN Lane := In2; Phase := 3; END_IF;',
 'Out1 := TRUE; Out3 := Lane; IF In3 THEN Phase := 4; END_IF;',
 'Out1 := TRUE; Out2 := TRUE; Out3 := Lane; IF NOT In4 THEN Phase := 5; END_IF;',
 'Out1 := TRUE; Out2 := TRUE; Out3 := Lane; IF In4 THEN Phase := 6; END_IF;',
 'Out2 := TRUE; Out3 := Lane; IF NOT In3 THEN Phase := 7; END_IF;',
 'Out3 := Lane; IF NOT In4 THEN Phase := 8; END_IF;',
 'Out3 := Lane; IF In4 THEN Count := Count + 1; Phase := 1; END_IF;',
];
export const sourceA=[header,'CASE Phase OF',...commands.map((cmd,i)=>i+': '+cmd),
 '9: Out0 := FALSE;','END_CASE;'].join('\n');
export const sourceB=[header,...commands.map((cmd,i)=>
 (i===0?'IF':'ELSIF')+' Phase = '+i+' THEN '+cmd),'END_IF;'].join('\n');
export function makeAutonomousRobotProject(source=sourceA):ProjectFile{
 const raw=makePlantSceneProject('robot-sort');
 const joins:[string,string][]=[
  ['scene-supply.P24','scene-plc.L+'],['scene-supply.M0','scene-plc.M'],
  ['scene-plc.Q0.0','feeder.CMD_feed+'],['scene-supply.M0','feeder.M-'],
  ['scene-plc.Q0.1','robot.CMD_grip+'],['scene-supply.M0','robot.M-'],
  ['scene-plc.Q0.2','robot.CMD_dispatch+'],
  ['scene-plc.Q0.3','robot.CMD_routeMetal+'],
  ['scene-plc.Q0.4','metal-out.CMD_run+'],['scene-supply.M0','metal-out.M-'],
  ['scene-plc.Q0.5','plain-out.CMD_run+'],['scene-supply.M0','plain-out.M-'],
  ['pickup.OUT_present','scene-plc.I0.1'],['eye.OUT_present','scene-plc.I0.2'],
  ['robot.OUT_partHeld','scene-plc.I0.3'],
  ['robot.OUT_inPosition','scene-plc.I0.4'],
  ['scene-supply.P24','pickup.L+'],['scene-supply.M0','pickup.M'],
  ['scene-supply.P24','eye.L+'],['scene-supply.M0','eye.M'],
  ['scene-supply.P24','robot.L+'],['scene-supply.M0','robot.M'],
 ];
 const wires:Wire[]=joins.map(([from,to],i)=>({id:'p15auto'+i,from,to}));
 const project:ProjectFile={...raw,wires,language:'st',stSource:source,
  params:{...raw.params,robot:{...raw.params?.robot,sortMode:1},
   eye:{...raw.params?.eye,rangeMm:400}}};
 const loaded=tick(createWorld(),[{k:'loadProject',project}]).world;
 expect(loaded.lastError).toBeNull();
 return loaded.project;
}
describe('P15 autonomous sensor-feedback robot sorting, real physical routing',()=>{
 it.each([['CASE',sourceA],['IF/ELSIF',sourceB]] as const)(
  '%s PLC architecture independently sorts both material classes and repairs the same second body',
  (_,source)=>{
   const project=makeAutonomousRobotProject(source);
   const old=JSON.stringify(project);
   expect(autonomousSortPreflight(project,'robot-sort')).toEqual([]);
   const a=runP15AutonomousSort(project,'robot-sort');
   expect(a.status,JSON.stringify(a,null,2)).toBe('passed');
   expect(a.produced).toBe(3);
   expect(a.sorted).toBe(3);
   expect(a.metal).toBeGreaterThan(0);
   expect(a.plain).toBeGreaterThan(0);
   expect(a.faultRecovered).toBe(true);
   expect(a.throughputPerSimHour).toBeGreaterThan(0);
   expect(a.cases.every(c=>c.pass)).toBe(true);
   expect(JSON.stringify(project)).toBe(old);
   expect(old).not.toContain('p15-auto-start');
  },45000);
 it('rejects constant ON, constant OFF and physically incorrect material routing',()=>{
  const p=makeAutonomousRobotProject();
  for(const source of [
   'Out0 := TRUE; Out1 := TRUE; Out2 := TRUE; Out3 := TRUE; Out4 := TRUE; Out5 := TRUE;',
   'Out0 := FALSE; Out1 := FALSE; Out2 := FALSE; Out3 := FALSE; Out4 := FALSE; Out5 := FALSE;',
  ]){
   const code=['VAR_INPUT',' In0 : BOOL;','END_VAR','VAR_OUTPUT',
    ...Array.from({length:6},(_,i)=>' Out'+i+' : BOOL;'),
    'END_VAR',source].join('\n');
   const r=runP15AutonomousSort({...p,stSource:code},'robot-sort');
   expect(r.status).toBe('failed');
  }
  const wrong=sourceA.replace('Lane := In2;','Lane := FALSE;');
  const r=runP15AutonomousSort({...p,stSource:wrong},'robot-sort');
  expect(r.status,JSON.stringify(r.cases)).toBe('failed');
  expect(r.cases.find(c=>c.id==='classification')?.pass).toBe(false);
 });
 it('blocks disconnected sensors, route terminal, power, wrong machine setting and injected learner fault',()=>{
  const p=makeAutonomousRobotProject();
  const candidates=[
   {...p,wires:p.wires.filter(w=>w.from!=='eye.OUT_present')},
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.3')},
   {...p,wires:p.wires.filter(w=>w.to!=='robot.M')},
   {...p,params:{...p.params,robot:{sortMode:0}}},
   {...p,plantFaults:{eye:'sensor-stuck-off'}},
  ];
  for(const candidate of candidates){
   const r=runP15AutonomousSort(candidate,'robot-sort');
   expect(r.status).toBe('blocked');
   expect(r.cases).toHaveLength(0);
  }
 });
 it('robot latches the actual material output and does not switch lanes in flight',()=>{
  const ctx=ctxOf({id:'robot',kind:'robot-arm',originMm:vec(0,0,0),
   yawDeg:0,params:{sortMode:1}});
  const box=spawnBody(freshWorld(),'feeder',{size:vec(160,110,95),
   massKg:8,pos:vec(0,0,100),tags:{material:'metal',origin:'feeder'}});
  let state=initial({}),world=box;
  for(let i=0;i<25;i++){
   const s=robotArm.step(state,world,{grip:true,routeMetal:true},10,null,ctx);
   state=s.state;world=s.world;
  }
  expect(state.heldBodyId).toBe('b1');
  expect(state.routeMetalLatched).toBe(true);
  for(let i=0;i<70;i++){
   const s=robotArm.step(state,world,{grip:true,dispatch:true,routeMetal:false},10,null,ctx);
   state=s.state;world=s.world;
  }
  expect(state.progress).toBeGreaterThan(200);
  expect(world.bodies[0].pos.y).toBeGreaterThan(200);
  expect(conserved(world)).toBe(true);
 });
});
