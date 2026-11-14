import {describe,it,expect} from 'vitest';
import {createWorld,tick} from '../src/sim/orchestrator';
import {freshWorld} from '../src/plant/world/bodies';
import {vec} from '../src/plant/world/math';
import {photoeye,inductiveProx} from '../src/plant/equipment/sensors';
import type {Body,World} from '../src/plant/world/types';
import type {EquipmentContext} from '../src/plant/world/equipment';
import type {Command,WorldState} from '../src/sim/signals';

const person:Body={
 id:'training-operator',shape:'cylinder',size:vec(400,400,1800),massKg:75,
 pos:vec(350,0,0),yawDeg:0,vel:vec(),supportedBy:null,
 tags:{material:'person',trainingOperator:true},
};
const ctx=(detectOperator=1):EquipmentContext=>({
 id:'eye',originMm:vec(0,0,0),yawDeg:0,
 params:{rangeMm:800,beamWidthMm:400,beamMode:1,
 responseMs:0,targetMode:1,detectOperator},
});
const sees=(detectOperator:number,def=photoeye,p=person):boolean=>{
 const w:World={...freshWorld(123),trainingOperator:p};
 const d=def.step(def.fresh({}),w,{},10,null,ctx(detectOperator));
 return d.state.engaged;
};
const cmd=(enabled:boolean,xMm=350,yMm=0,feetMm=0):Command=>({
 k:'setTrainingOperator',enabled,xMm,yMm,feetMm,
});
const ST=['VAR_INPUT',' In0 : BOOL;', 'END_VAR','VAR_OUTPUT',
 ' Out0 : BOOL;','END_VAR','Out0 := In0;'].join('\n');
const commands:Command[]=[
 {k:'place',id:'supply',kind:'supply',at:{x:20,y:10}},
 {k:'place',id:'plc16',kind:'plc16',at:{x:260,y:10}},
 {k:'place',id:'eye',kind:'geometry-photoeye',at:{x:455,y:225}},
 {k:'place',id:'lamp',kind:'lamp',at:{x:890,y:225}},
 ...([
  ['supply.P24','plc16.L+'],['supply.M0','plc16.M'],
  ['supply.P24','eye.L+'],['supply.M0','eye.M'],
  ['eye.OUT_present','plc16.I0.0'],['plc16.Q0.0','lamp.L+'],
  ['supply.M0','lamp.M-'],
 ] as const).map(([from,to],i):Command=>({
  k:'wire',id:'w'+(i+1),from,to,
 })),
 {k:'loadST',source:ST},
 {k:'setParam',id:'eye',key:'rangeMm',value:800},
 {k:'setParam',id:'eye',key:'responseMs',value:0},
 {k:'setParam',id:'eye',key:'beamMode',value:1},
 {k:'setParam',id:'eye',key:'targetMode',value:1},
 {k:'setParam',id:'eye',key:'detectOperator',value:1},
];
const scans=(w:WorldState,n:number):WorldState=>{
 for(let i=0;i<n;i++)w=tick(w).world;
 return w;
};
describe('P8 explicitly enabled training person uses the worker, not an inferred camera PLC input',()=>{
 it('detects a worker proxy only with deliberate per-sensor opt-in',()=>{
  expect(sees(0)).toBe(false);
  expect(sees(1)).toBe(true);
  expect(sees(1,inductiveProx)).toBe(false);
  expect(sees(1,photoeye,{...person,pos:vec(-550,0,0)})).toBe(false);
 });
 it('passes the actual 24V eye -> PLC16 Structured Text -> lamp chain, then clears',()=>{
  let state=tick(createWorld(),[...commands,cmd(true)]).world;
  expect(state.lastError).toBeNull();
  expect(state.plantWorld.world.trainingOperator?.pos.x).toBe(350);
  expect(state.plantWorld.world.bodies).toHaveLength(0);
  state=scans(tick(state,[{k:'run'}]).world,5);
  expect(state.lastError).toBeNull();
  expect(state.plantWorld.signals.eye.present).toBe(true);
  expect(state.plcs.plc16.tagInputs.In0).toBe(true);
  expect(state.plcs.plc16.coils.Out0).toBe(true);
  expect(state.deviceOn.lamp).toBe(true);
  state=scans(tick(state,[cmd(false,0,0,0)]).world,5);
  expect(state.plantWorld.world.trainingOperator).toBeUndefined();
  expect(state.plantWorld.signals.eye.present).toBe(false);
  expect(state.plcs.plc16.coils.Out0).toBe(false);
  expect(state.deviceOn.lamp).toBe(false);
 });
 it('rejects a nonfinite or out-of-bounds camera coordinate without mutating actor',()=>{
  const initial=tick(createWorld(),[cmd(true)]).world;
  const stable=JSON.stringify(initial.plantWorld.world.trainingOperator);
  for(const invalid of [cmd(true,Number.NaN),cmd(true,9000),cmd(true,350,0,5000)]){
   const next=tick(initial,[invalid]).world;
   expect(next.lastError).toMatch(/Invalid simulated operator position/);
   expect(JSON.stringify(next.plantWorld.world.trainingOperator)).toBe(stable);
  }
 });
 it('resets actor with the simulation and never persists it in the project JSON',()=>{
  const state=tick(createWorld(),[cmd(true)]).world;
  expect(state.plantWorld.world.trainingOperator).toBeDefined();
  expect(JSON.stringify(state.project)).not.toContain('training-operator');
  const reset=tick(state,[{k:'reset'}]).world;
  expect(reset.plantWorld.world.trainingOperator).toBeUndefined();
 });
});
