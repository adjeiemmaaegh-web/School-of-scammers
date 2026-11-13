/**
 * P21 two ORIGINAL physical cartons queue behind a real closed stopper.
 * No forced equipment faults, synthetic jam signals or directly set body tags:
 * the only provenance is the 10ms worker-owned body collision solver.
 */
import {describe,it,expect} from 'vitest';
import {freshWorld,spawnBody,despawnBody,conserved} from '../src/plant/world/bodies';
import {freshRuntime,stepScene} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {vec} from '../src/plant/world/math';
import type {EquipmentPlacement} from '../src/plant/world/types';
type Inputs={gate?:boolean,push?:boolean,reset?:boolean,run?:boolean};
function placements(mode=1,dwell=200):EquipmentPlacement[]{
 return [
  {id:'belt',kind:'belt-conveyor',originMm:vec(0,0,0),yawDeg:0,
   params:{lengthMm:600,widthMm:150,speedMmS:250,jamResetMode:1,
    obstructionTripMode:0,accumulationTripMode:mode,accumulationDwellMs:dwell}},
  {id:'stopper',kind:'stopper',originMm:vec(240,0,0),yawDeg:0,
   params:{travelMs:100}},
  {id:'pusher',kind:'pusher',originMm:vec(180,0,0),yawDeg:0,
   params:{speedMmS:250,strokeMm:260,maxMassKg:20}},
 ];
}
function setup(mode=1,dwell=200){
 const a=spawnBody(freshWorld(), 'original-source',{
  size:vec(160,128,96),massKg:8,pos:vec(70,0,120),
  supportedBy:'belt',tags:{material:'cardboard',origin:'original-source'}});
 const b=spawnBody(a,'original-source',{
  size:vec(160,128,96),massKg:8,pos:vec(-190,0,120),
  supportedBy:'belt',tags:{material:'metal',origin:'original-source'}});
 return freshRuntime(b,placements(mode,dwell),PLANT_EQUIPMENT);
}
function step(w:ReturnType<typeof setup>,i:Inputs={},mode=1,dwell=200){
 return stepScene(w,placements(mode,dwell),PLANT_EQUIPMENT,{
  belt:{run:i.run!==false,resetJam:i.reset===true},
  stopper:{extend:i.gate!==false},
  pusher:{extend:i.push===true},
 });
}
function advanceUntil(predicate:(w:ReturnType<typeof setup>)=>boolean,
 mode=1,dwell=200){
 let w=setup(mode,dwell);
 for(let i=0;i<160&&!predicate(w);i++)w=step(w,{},mode,dwell);
 return w;
}
describe('P21 opt-in sustained original body-to-body queue trip',()=>{
 it('two genuinely queued bodies physically trip their conveyor after dwell with stable individual IDs',()=>{
  let w=advanceUntil(s=>s.signals.belt.accumulationTripped===true);
  expect(w.signals.belt.accumulationTripped).toBe(true);
  expect(w.signals.belt.moving).toBe(false);
  expect(w.signals.belt.speed).toBe(0);
  expect(w.signals.belt.queueDwellMs).toBeGreaterThanOrEqual(200);
  expect(w.world.model.belt.accumulationBodyId).toBe('b2');
  expect(w.world.model.belt.accumulationBlockingBodyId).toBe('b1');
  expect(w.world.bodies.find(b=>b.id==='b2')?.tags.jammedByBody).toBe('b1');
  expect(w.world.bodies.find(b=>b.id==='b1')?.tags.jammedByGate).toBe('stopper');
  const positions=w.world.bodies.map(x=>({id:x.id,x:x.pos.x,y:x.pos.y}));
  for(let i=0;i<40;i++){
   w=step(w);
   expect(w.world.bodies.map(x=>({id:x.id,x:x.pos.x,y:x.pos.y}))).toEqual(positions);
   expect(w.signals.belt.accumulationTripped).toBe(true);
   expect(conserved(w.world)).toBe(true);
  }
 });
 it('a brief body collision before the configured dwell threshold cannot trip the actual machine',()=>{
  let w=setup(1,1000);
  for(let n=0;n<160&&!w.world.bodies.some(b=>b.tags.jammedByBody==='b1');n++)
   w=step(w,{},1,1000);
  expect(w.world.bodies.some(b=>b.tags.jammedByBody==='b1')).toBe(true);
  expect(w.signals.belt.accumulationTripped).toBe(false);
  expect(w.world.model.belt.accumulationContactMs).toBeLessThan(1000);
  // The real pusher and gate are moved before a continuous 1000ms dwell.
  for(let n=0;n<35;n++)w=step(w,{gate:false,push:true},1,1000);
  expect(w.world.bodies.length).toBe(2);
  expect(w.signals.belt.accumulationTripped).toBe(false);
  expect(conserved(w.world)).toBe(true);
 });
 it('reset while physical leader is still on the source belt fails; gate release alone does not authorize restart',()=>{
  let w=advanceUntil(s=>s.signals.belt.accumulationTripped===true);
  const b2x=w.world.bodies.find(b=>b.id==='b2')!.pos.x;
  w=step(w,{reset:true});
  expect(w.signals.belt.accumulationTripped).toBe(true);
  w=step(w,{reset:false});
  for(let n=0;n<15;n++)w=step(w,{gate:false});
  expect(w.signals.stopper.retracted).toBe(true);
  expect(w.signals.belt.accumulationTripped).toBe(true);
  expect(w.world.bodies.find(b=>b.id==='b2')?.pos.x).toBe(b2x);
  // No physical pusher clearance, so even a fresh reset is unsafe.
  w=step(w,{gate:false,reset:true});
  expect(w.signals.belt.accumulationTripped).toBe(true);
  expect(w.world.bodies.find(b=>b.id==='b2')?.pos.x).toBe(b2x);
 });
 it('true PLC-equivalent pusher moves original leader outside the belt, then a fresh reset frees original queued body',()=>{
  let w=advanceUntil(s=>s.signals.belt.accumulationTripped===true);
  const x=w.world.bodies.find(b=>b.id==='b2')!.pos.x;
  for(let n=0;n<50;n++)w=step(w,{gate:false,push:true});
  expect(w.signals.stopper.retracted).toBe(true);
  const leader=w.world.bodies.find(b=>b.id==='b1')!;
  expect(leader.pos.y).toBeGreaterThan(75);
  expect(leader.supportedBy).not.toBe('belt');
  expect(w.world.bodies.find(b=>b.id==='b2')?.supportedBy).toBe('belt');
  expect(w.signals.belt.accumulationTripped).toBe(true);
  expect(w.world.bodies.find(b=>b.id==='b2')?.pos.x).toBe(x);
  w=step(w,{gate:false,push:true,reset:true});
  expect(w.signals.belt.accumulationTripped).toBe(false);
  expect(w.signals.belt.moving).toBe(true);
  for(let n=0;n<18;n++)w=step(w,{gate:false,push:true});
  expect(w.world.bodies.find(b=>b.id==='b2')!.pos.x).toBeGreaterThan(x+40);
  expect(w.world.bodies.map(b=>b.id)).toEqual(['b1','b2']);
  expect(conserved(w.world)).toBe(true);
 });
 it('deleting the leader is not a valid reset or identity-preserving physical clearance',()=>{
  let w=advanceUntil(s=>s.signals.belt.accumulationTripped===true);
  w={...w,world:despawnBody(w.world,'unsafe-erasure','b1')};
  w=step(w,{gate:false,reset:true});
  expect(w.signals.belt.accumulationTripped).toBe(true);
  expect(conserved(w.world)).toBe(true);
  expect(w.world.despawnedCount).toBe(1);
 });
 it('default P20/P8 body queue semantics remain non-latched without P21 opt-in',()=>{
  let w=advanceUntil(s=>s.world.bodies.some(b=>b.tags.jammedByBody==='b1'),0);
  expect(w.world.bodies.some(b=>b.tags.jammedByBody==='b1')).toBe(true);
  expect(w.signals.belt.accumulationTripped).toBe(false);
  expect(w.signals.belt.moving).toBe(true);
  expect(w.world.model.belt.stalled).toBe(false);
 });
 it('same original two-body seeded model state replays exactly without non-deterministic timers',()=>{
  const make=()=>{
   let w=advanceUntil(s=>s.signals.belt.accumulationTripped===true);
   for(let n=0;n<15;n++)w=step(w);
   return w;
  };
  expect(make()).toEqual(make());
 });
});
