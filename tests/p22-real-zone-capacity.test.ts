import {describe,it,expect} from 'vitest';
import {freshWorld,spawnBody,conserved} from '../src/plant/world/bodies';
import {freshRuntime,stepScene,validatePlacements} from '../src/plant/world/runner';
import {PLANT_EQUIPMENT} from '../src/plant/equipment';
import {vec} from '../src/plant/world/math';
import type {EquipmentPlacement} from '../src/plant/world/types';
import {p22ReferenceProject} from './fixtures/p22-zone-programs';
import {p22ZonePreflight,runP22ZoneCampaign} from '../src/plant/scenes/matrix-p22';

function placements(mode=1,capacity=2):EquipmentPlacement[]{
 return [{id:'belt',kind:'belt-conveyor',originMm:vec(0,0,0),yawDeg:0,
   params:{lengthMm:600,widthMm:150,speedMmS:250,accumulationTripMode:1,
    accumulationDwellMs:200,zoneSensorMode:mode,zoneCapacity:capacity}},
  {id:'stopper',kind:'stopper',originMm:vec(240,0,0),yawDeg:0,params:{travelMs:100}},
  {id:'pusher',kind:'pusher',originMm:vec(180,0,0),yawDeg:0,
   params:{speedMmS:250,strokeMm:260,maxMassKg:20}}];
}
function pair(){
 let w=spawnBody(freshWorld(),'feeder',{
  size:vec(160,128,96),massKg:8,pos:vec(70,0,120),supportedBy:'belt',
  tags:{origin:'feeder',material:'metal'}});
 w=spawnBody(w,'feeder',{
  size:vec(160,128,96),massKg:8,pos:vec(-190,0,120),supportedBy:'belt',
  tags:{origin:'feeder',material:'cardboard'}});
 return w;
}
describe('P22 real source-belt occupied/full sensor',()=>{
 it('reports two genuinely conserved source cartons, not a PLC memory count',()=>{
  const r=freshRuntime(pair(),placements(),PLANT_EQUIPMENT);
  expect(r.signals.belt.zoneCount).toBe(2);
  expect(r.signals.belt.zoneOccupied).toBe(true);
  expect(r.signals.belt.zoneFull).toBe(true);
  expect(r.signals.belt.accumulationTripped).toBe(false);
  expect(conserved(r.world)).toBe(true);
 });
 it('is explicitly opt-in and does not alter inherited P21 behavior',()=>{
  const r=freshRuntime(pair(),placements(0),PLANT_EQUIPMENT);
  expect(r.signals.belt.zoneCount).toBe(0);
  expect(r.signals.belt.zoneOccupied).toBe(false);
  expect(r.signals.belt.zoneFull).toBe(false);
  expect(r.signals.belt.accumulationTripped).toBe(false);
 });
 it('capacity thresholds use true count, with independently bounded sensor setting',()=>{
  for(const [capacity,full] of [[1,true],[2,true],[3,false],[5,false]] as const){
   const r=freshRuntime(pair(),placements(1,capacity),PLANT_EQUIPMENT);
   expect(r.signals.belt.zoneCount).toBe(2);
   expect(r.signals.belt.zoneFull).toBe(full);
  }
  for(const invalid of [0,6,2.5]){
   expect(()=>validatePlacements(placements(1,invalid),PLANT_EQUIPMENT)).toThrow();
  }
  expect(()=>validatePlacements(placements(2),PLANT_EQUIPMENT)).toThrow();
 });
 it('excludes a body outside physical footprint, even if a stale support tag claims the belt',()=>{
  const w={...pair(),bodies:[...pair().bodies.map((b,i)=>i===1?
   {...b,pos:vec(340,0,120)}:b)]};
  const r=freshRuntime(w,placements(),PLANT_EQUIPMENT);
  expect(r.signals.belt.zoneCount).toBe(1);
  expect(r.signals.belt.zoneFull).toBe(false);
 });
 it('excludes ejected and foreign-carrier bodies despite their physically nearby positions',()=>{
  const w=pair();
  const other={...w,bodies:w.bodies.map((b,i)=>i===0?
   {...b,supportedBy:'pusher'}:b)};
  const r=freshRuntime(other,placements(),PLANT_EQUIPMENT);
  expect(r.signals.belt.zoneCount).toBe(1);
  expect(r.signals.belt.zoneFull).toBe(false);
 });
 it('honours 90-degree conveyor orientation, never screen-space or rendered coordinates',()=>{
  const place:EquipmentPlacement={id:'belt',kind:'belt-conveyor',
   originMm:vec(0,0,0),yawDeg:90,
   params:{lengthMm:600,widthMm:150,zoneSensorMode:1,zoneCapacity:2}};
  let w=spawnBody(freshWorld(),'feeder',{
   size:vec(80,70,90),massKg:4,pos:vec(0,240,120),supportedBy:'belt',tags:{}});
  w=spawnBody(w,'feeder',{
   size:vec(80,70,90),massKg:4,pos:vec(160,0,120),supportedBy:'belt',tags:{}});
  const r=freshRuntime(w,[place],PLANT_EQUIPMENT);
  expect(r.signals.belt.zoneCount).toBe(1);
  expect(r.signals.belt.zoneFull).toBe(false);
 });
 it('physically pushing original leader out decrements live count while P21 latch stays set',()=>{
  const items=placements();
  let r=freshRuntime(pair(),items,PLANT_EQUIPMENT);
  for(let k=0;k<160&&!r.signals.belt.accumulationTripped;k++)
   r=stepScene(r,items,PLANT_EQUIPMENT,{
    belt:{run:true},stopper:{extend:true},pusher:{extend:false}});
  expect(r.signals.belt.accumulationTripped).toBe(true);
  expect(r.signals.belt.zoneCount).toBe(2);
  for(let k=0;k<50;k++)r=stepScene(r,items,PLANT_EQUIPMENT,{
   belt:{run:true},stopper:{extend:false},pusher:{extend:true}});
  expect(r.world.bodies.find(b=>b.id==='b1')?.supportedBy).not.toBe('belt');
  expect(r.world.bodies.find(b=>b.id==='b2')?.supportedBy).toBe('belt');
  expect(r.signals.belt.zoneCount).toBe(1);
  expect(r.signals.belt.zoneFull).toBe(false);
  expect(r.signals.belt.accumulationTripped).toBe(true);
  expect(conserved(r.world)).toBe(true);
 });
});

describe('P22 authentic 24V PLC / physical three-carton backpressure commissioning',()=>{
 it('three independent genuine three-carton material lots and exact replay pass with authored correct source',()=>{
  const p=p22ReferenceProject();
  const before=JSON.stringify(p);
  expect(p22ZonePreflight(p,'gate-accumulation')).toEqual([]);
  const result=runP22ZoneCampaign(p,'gate-accumulation');
  expect(result.status,JSON.stringify(result,null,2)).toBe('passed');
  expect(result.lots.map(l=>l.seed)).toEqual([1,42,65535,42]);
  expect(result.totalOriginals).toBe(9);
  expect(result.deterministicReplay).toBe(true);
  for(const lot of result.lots){
   expect(lot.pass,JSON.stringify(lot,null,2)).toBe(true);
   expect(lot.initialZoneCount).toBe(2);
   expect(lot.zoneFullBeforeTrip).toBe(true);
   expect(lot.plcSensedFull).toBe(true);
   expect(lot.thirdFeedInhibited).toBe(true);
   expect(lot.pairTripped).toBe(true);
   expect(lot.leaderCleared).toBe(true);
   expect(lot.postClearanceCount).toBe(1);
   expect(lot.resetFromPlc).toBe(true);
   expect(lot.followerRecovered).toBe(true);
   expect(lot.thirdFedAfterRestart).toBe(true);
   expect(lot.produced).toBe(3);
   expect(lot.originalIds).toEqual(['b1','b2','b3']);
   expect(lot.cases.every(c=>c.pass)).toBe(true);
  }
  expect(JSON.stringify(p)).toBe(before);
  expect(before).not.toContain('p22-start');
 },120000);
 it.each(['unsafe-third','blind-trip','never-third','no-reset'] as const)(
  'rejects wrong powered learner PLC logic: %s',kind=>{
   const r=runP22ZoneCampaign(p22ReferenceProject(kind),'gate-accumulation');
   expect(r.status,JSON.stringify(r,null,2)).toBe('failed');
   expect(r.lots.some(l=>!l.pass)).toBe(true);
   if(kind==='unsafe-third'||kind==='blind-trip'){
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='early-third-feed-inhibited'&&!c.pass))).toBe(true);
   }else if(kind==='never-third'){
    expect(r.lots.some(l=>l.cases.some(c=>
     c.id==='fresh-third-after-release'&&!c.pass))).toBe(true);
   }
  },120000);
 it('blocks disconnected, forged, off-mode or wrong-capacity full-zone feedback',()=>{
  const p=p22ReferenceProject();
  const changes=[
   {...p,wires:p.wires.filter(w=>w.from!=='belt.OUT_zoneFull')},
   {...p,wires:p.wires.filter(w=>w.from!=='scene-plc.Q0.0')},
   {...p,params:{...p.params,belt:{...p.params?.belt,zoneSensorMode:0}}},
   {...p,params:{...p.params,belt:{...p.params?.belt,zoneCapacity:3}}},
   {...p,components:[...p.components,{id:'p22-more',kind:'start' as const,x:10,y:10,pressed:false}]},
  ];
  for(const invalid of changes){
   const r=runP22ZoneCampaign(invalid,'gate-accumulation');
   expect(r.status,r.diagnostic).toBe('blocked');
   expect(r.lots).toEqual([]);
  }
  expect(runP22ZoneCampaign(p,'bottle-line').status).toBe('blocked');
 },120000);
});
